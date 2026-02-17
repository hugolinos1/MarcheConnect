"use client"
import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Exhibitor } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { ShieldCheck, Zap, Utensils, Camera, Loader2, X, FileText } from 'lucide-react';
import Link from 'next/link';
import { sendFinalConfirmationEmail } from '@/app/actions/email-actions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';

/**
 * Sous-composant pour isoler le formulaire et éviter les erreurs de rendu initial
 * Utilise des balises <img> standards car next/image n'aime pas les Base64 lourds en prod.
 */
function FinalizationForm({ exhibitor, currentConfig }: { exhibitor: Exhibitor; currentConfig: any }) {
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const priceTable1 = currentConfig?.priceTable1 ?? 40;
  const priceTable2 = currentConfig?.priceTable2 ?? 60;
  const priceMeal = currentConfig?.priceMeal ?? 8;

  const formSchema = useMemo(() => {
    const isPro = exhibitor.isRegistered === true;
    return z.object({
      siret: isPro ? z.string().min(9, "SIRET requis") : z.string().optional(),
      idCardPhoto: z.string().min(1, "Photo requise"),
      needsElectricity: z.boolean().default(false),
      sundayLunchCount: z.coerce.number().min(0).max(6),
      insuranceCompany: z.string().min(2, "Nom requis"),
      insurancePolicyNumber: z.string().min(5, "N° requis"),
      agreedToTerms: z.boolean().refine(v => v === true, "Acceptation requise"),
    });
  }, [exhibitor.isRegistered]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      siret: exhibitor.detailedInfo?.siret || "",
      idCardPhoto: exhibitor.detailedInfo?.idCardPhoto || "",
      needsElectricity: exhibitor.detailedInfo?.needsElectricity || false,
      sundayLunchCount: exhibitor.detailedInfo?.sundayLunchCount || 0,
      insuranceCompany: exhibitor.detailedInfo?.insuranceCompany || "",
      insurancePolicyNumber: exhibitor.detailedInfo?.insurancePolicyNumber || "",
      agreedToTerms: exhibitor.detailedInfo?.agreedToTerms || false,
    },
  });

  const watchLunchCount = form.watch("sundayLunchCount") || 0;
  const idCardPhoto = form.watch("idCardPhoto");
  
  const standPrice = exhibitor.requestedTables === '1' ? priceTable1 : priceTable2;
  const totalToPay = standPrice + (watchLunchCount * priceMeal);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 1000;
        let w = img.width;
        let h = img.height;
        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
        else { if (h > MAX) { h *= MAX / h; h = MAX; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0, w, h);
        form.setValue('idCardPhoto', canvas.toDataURL('image/jpeg', 0.5));
        setIsProcessingImage(false);
      };
    };
    reader.readAsDataURL(file);
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const detailRef = doc(db, 'exhibitor_details', exhibitor.id);
      setDocumentNonBlocking(detailRef, {
        ...values,
        id: exhibitor.id,
        preRegistrationId: exhibitor.id,
        marketConfigurationId: currentConfig?.id || 'default',
        submissionDate: new Date().toISOString(),
        adminValidationStatus: 'PENDING_REVIEW'
      }, { merge: true });

      updateDocumentNonBlocking(doc(db, 'pre_registrations', exhibitor.id), { 
        status: 'submitted_form2',
        detailedInfo: values
      });

      await sendFinalConfirmationEmail(exhibitor, values, currentConfig);
      router.push('/register/success?type=final');
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur lors de la validation" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
        <div className="space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-3 border-b pb-2"><FileText className="w-5 h-5" /> Administratif</h3>
          {exhibitor.isRegistered && (
            <FormField control={form.control} name="siret" render={({ field }) => (
              <FormItem><FormLabel>Numéro de SIRET *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          )}
          <FormField control={form.control} name="idCardPhoto" render={() => (
            <FormItem>
              <FormLabel>Pièce d'identité (Recto) *</FormLabel>
              <div className="mt-2">
                {idCardPhoto ? (
                  <div className="relative border rounded p-1 bg-white inline-block">
                    <img src={idCardPhoto} alt="ID" className="max-h-48 rounded" />
                    <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={() => form.setValue('idCardPhoto', '')}><X className="w-3 h-3" /></Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-32 w-full border-2 border-dashed rounded bg-muted/20 cursor-pointer">
                    {isProcessingImage ? <Loader2 className="animate-spin" /> : <><Camera className="mb-2" /><span>Charger la photo</span></>}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-3 border-b pb-2"><Zap className="w-5 h-5" /> Logistique</h3>
          <FormField control={form.control} name="needsElectricity" render={({ field }) => (
            <FormItem className="flex items-center space-x-3 space-y-0 rounded border p-4 bg-white">
              <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              <FormLabel className="font-bold">Besoin d'électricité ?</FormLabel>
            </FormItem>
          )} />
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-3 border-b pb-2"><Utensils className="w-5 h-5" /> Repas</h3>
          <FormField control={form.control} name="sundayLunchCount" render={({ field }) => (
            <FormItem>
              <FormLabel>Plateaux repas Dimanche ({priceMeal}€/unité)</FormLabel>
              <FormControl><Input type="number" {...field} className="w-24" /></FormControl>
            </FormItem>
          )} />
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-3 border-b pb-2"><ShieldCheck className="w-5 h-5" /> Assurance</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <FormField control={form.control} name="insuranceCompany" render={({ field }) => (
              <FormItem><FormLabel>Assurance</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="insurancePolicyNumber" render={({ field }) => (
              <FormItem><FormLabel>N° Police</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
          </div>
        </div>

        <div className="bg-primary p-6 text-white rounded-xl shadow-inner text-right">
          <p className="text-sm font-medium opacity-80 uppercase tracking-widest">Montant à régler par chèque</p>
          <p className="text-3xl font-bold">{totalToPay} €</p>
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full h-14 text-lg font-bold">
          {isSubmitting ? <Loader2 className="animate-spin" /> : "Valider mon dossier"}
        </Button>
      </form>
    </Form>
  );
}

export default function DetailsPage() {
  const { id } = useParams();
  const db = useFirestore();

  const configsRef = useMemoFirebase(() => collection(db, 'market_configurations'), [db]);
  const { data: configs } = useCollection(configsRef);
  const currentConfig = configs?.find(c => c.currentMarket) || configs?.[0];

  const exhibitorRef = useMemoFirebase(() => id ? doc(db, 'pre_registrations', id as string) : null, [db, id]);
  const { data: exhibitor, isLoading } = useDoc<Exhibitor>(exhibitorRef);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!exhibitor) return <div className="min-h-screen flex items-center justify-center p-4"><Card className="p-8 text-center"><p>Dossier introuvable</p><Button asChild variant="link"><Link href="/">Accueil</Link></Button></Card></div>;

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 relative">
      <ChristmasSnow />
      <div className="max-w-2xl mx-auto relative z-10">
        <Card className="shadow-2xl border-t-8 border-t-primary overflow-hidden">
          <div className="p-8 bg-primary text-white"><h1 className="text-2xl font-bold">Finalisation : {exhibitor.companyName}</h1></div>
          <CardContent className="p-8 bg-white/50 backdrop-blur-md">
            <FinalizationForm exhibitor={exhibitor} currentConfig={currentConfig} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
