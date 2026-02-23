"use client"
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Exhibitor } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { ShieldCheck, Zap, Utensils, Ticket, Camera, Info, ArrowLeft, Heart, CheckCircle2, Calculator, Mail, Loader2, LayoutGrid, FileText, X } from 'lucide-react';
import Link from 'next/link';
import { sendFinalConfirmationEmail } from '@/app/actions/email-actions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';

export default function DetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const logoUrl = "https://i.ibb.co/yncRPkvR/logo-ujpf.jpg";

  const marketConfigRef = useMemoFirebase(() => collection(db, 'market_configurations'), [db]);
  const { data: configs } = useCollection(marketConfigRef);
  const currentConfig = configs?.find(c => c.currentMarket) || configs?.[0];

  const exhibitorRef = useMemoFirebase(() => id ? doc(db, 'pre_registrations', id as string) : null, [db, id]);
  const { data: exhibitor, isLoading: isExhibitorLoading } = useDoc<Exhibitor>(exhibitorRef);

  const formSchema = useMemo(() => {
    const isPro = exhibitor?.isRegistered === true;
    return z.object({
      siret: isPro ? z.string().min(9, "SIRET requis pour les professionnels") : z.string().optional(),
      idCardPhoto: z.string().min(1, "La photo de la pièce d'identité est obligatoire"),
      needsElectricity: z.boolean().default(false),
      needsGrid: z.boolean().default(false),
      sundayLunchCount: z.coerce.number().min(0, "Minimum 0").max(10, "Maximum 10"),
      tombolaLot: z.boolean().default(true),
      tombolaLotDescription: z.string().optional(),
      insuranceCompany: z.string().min(2, "Nom de la compagnie requis"),
      insurancePolicyNumber: z.string().min(5, "N° de contrat requis"),
      agreedToImageRights: z.boolean().refine(val => val === true, "L'acceptation est requise"),
      agreedToTerms: z.boolean().refine(val => val === true, "L'acceptation est requise"),
      additionalComments: z.string().optional(),
    });
  }, [exhibitor?.isRegistered]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      siret: "",
      idCardPhoto: "",
      needsElectricity: false,
      needsGrid: false,
      sundayLunchCount: 0,
      tombolaLot: true,
      tombolaLotDescription: "",
      insuranceCompany: "",
      insurancePolicyNumber: "",
      agreedToImageRights: false,
      agreedToTerms: false,
      additionalComments: "",
    },
  });

  const watchLunchCount = form.watch("sundayLunchCount") || 0;
  const idCardPhoto = form.watch("idCardPhoto");
  
  const standPrice = exhibitor?.requestedTables === '1' ? (currentConfig?.priceTable1 ?? 40) : (currentConfig?.priceTable2 ?? 60);
  const totalToPay = standPrice + (watchLunchCount * (currentConfig?.priceMeal ?? 8));

  useEffect(() => {
    if (exhibitor?.detailedInfo) {
      form.reset(exhibitor.detailedInfo);
    }
  }, [exhibitor, form]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingImage(true);
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.src = ev.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        form.setValue('idCardPhoto', canvas.toDataURL('image/jpeg', 0.7));
        setIsProcessingImage(false);
      };
    };
    reader.readAsDataURL(file);
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!exhibitor) return;
    setIsSubmitting(true);
    try {
      const detailedData = {
        ...values,
        id: exhibitor.id,
        preRegistrationId: exhibitor.id,
        marketConfigurationId: currentConfig?.id || 'default',
        submittedAt: new Date().toISOString(),
        adminValidationStatus: 'PENDING_REVIEW'
      };
      
      // Enregistrement dans les deux collections pour plus de sécurité
      setDocumentNonBlocking(doc(db, 'exhibitor_details', exhibitor.id), detailedData, { merge: true });
      updateDocumentNonBlocking(doc(db, 'pre_registrations', exhibitor.id), { 
        status: 'submitted_form2',
        detailedInfo: detailedData
      });

      // Tentative d'envoi d'email mais on ne bloque pas si ça échoue
      sendFinalConfirmationEmail(exhibitor, values, currentConfig).catch(e => console.error("Email final error", e));
      
      toast({ title: "Dossier enregistré !", description: "Merci pour votre finalisation." });
      
      // Petit délai pour laisser le temps aux opérations Firestore non-bloquantes de partir
      setTimeout(() => {
        router.push('/register/success?type=final');
      }, 1000);
      
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur technique", description: "Veuillez réessayer." });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isExhibitorLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  if (!exhibitor) return <div className="min-h-screen flex flex-col items-center justify-center p-4"><h1>Dossier introuvable ou lien expiré.</h1></div>;

  return (
    <div className="min-h-screen bg-background py-12 px-4 relative">
      <ChristmasSnow />
      <div className="container mx-auto max-w-3xl relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-8 font-medium"><ArrowLeft className="w-4 h-4" /> Retour au site</Link>
        <Card className="border-t-8 border-t-primary shadow-2xl overflow-hidden bg-white/95">
          <div className="bg-primary text-white p-8 flex items-center justify-between gap-6 border-b">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold">Dossier Technique</h1>
              <p className="text-lg text-accent">{exhibitor.companyName}</p>
            </div>
            <img src={logoUrl} alt="Logo" className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-white/20" />
          </div>
          <CardContent className="p-4 md:p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
                <div className="space-y-6">
                  <h3 className="text-lg font-bold border-b pb-3 flex items-center gap-3 text-primary"><FileText className="w-5 h-5 text-secondary" /> Administratif</h3>
                  {exhibitor.isRegistered && (
                    <FormField control={form.control} name="siret" render={({ field }) => (
                      <FormItem><FormLabel>SIRET *</FormLabel><FormControl><Input placeholder="14 chiffres" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  )}
                  <FormField control={form.control} name="idCardPhoto" render={() => (
                    <FormItem className="space-y-4">
                      <FormLabel>Pièce d'identité (Recto) *</FormLabel>
                      <FormControl>
                        <div className="flex flex-col gap-4">
                          {idCardPhoto ? (
                            <div className="relative aspect-video max-w-sm rounded-lg overflow-hidden border group bg-muted">
                              <img src={idCardPhoto} alt="ID" className="w-full h-full object-contain" />
                              <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2" onClick={() => form.setValue('idCardPhoto', '')}><X className="w-4 h-4" /></Button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center aspect-video max-w-sm rounded-lg border-2 border-dashed border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors">
                              {isProcessingImage ? <Loader2 className="animate-spin text-primary" /> : <><Camera className="w-10 h-10 mb-2 text-primary/50" /><span>Prendre en photo / Charger</span></>}
                              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-bold border-b pb-3 flex items-center gap-3 text-primary"><Zap className="w-5 h-5 text-secondary" /> Logistique</h3>
                  <div className="grid gap-4">
                    <FormField control={form.control} name="needsElectricity" render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 p-4 border rounded-xl bg-white"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="leading-none"><FormLabel className="text-base font-bold">Besoin électricité ?</FormLabel><FormDescription>Supplément de {currentConfig?.priceElectricity ?? 1}€ sur place.</FormDescription></div></FormItem>
                    )} />
                    <FormField control={form.control} name="needsGrid" render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 p-4 border rounded-xl bg-white"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="leading-none"><FormLabel className="text-base font-bold">Besoin grille d'expo ?</FormLabel></div></FormItem>
                    )} />
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-bold border-b pb-3 flex items-center gap-3 text-primary"><Utensils className="w-5 h-5 text-secondary" /> Repas Dimanche</h3>
                  <FormField control={form.control} name="sundayLunchCount" render={({ field }) => (
                    <FormItem><FormLabel>Nombre de plateaux repas ({currentConfig?.priceMeal ?? 8}€ / unité)</FormLabel><FormControl><Input type="number" {...field} className="w-24 text-center font-bold" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-bold border-b pb-3 flex items-center gap-3 text-primary"><ShieldCheck className="w-5 h-5 text-secondary" /> Assurance Responsabilité Civile</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="insuranceCompany" render={({ field }) => (
                      <FormItem><FormLabel>Compagnie d'assurance *</FormLabel><FormControl><Input placeholder="ex: AXA, MAIF..." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="insurancePolicyNumber" render={({ field }) => (
                      <FormItem><FormLabel>N° de Contrat / Police *</FormLabel><FormControl><Input placeholder="ex: 123456789" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </div>

                <div className="p-6 bg-secondary/5 rounded-2xl border space-y-4">
                   <FormField control={form.control} name="agreedToImageRights" render={({ field }) => (
                    <FormItem className="flex items-start space-x-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm font-bold">J'accepte le droit à l'image (photos du marché)</FormLabel><FormMessage /></FormItem>
                  )} />
                   <FormField control={form.control} name="agreedToTerms" render={({ field }) => (
                    <FormItem className="flex items-start space-x-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm font-bold">Je m'engage à respecter le règlement intérieur</FormLabel><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="p-6 bg-primary text-white rounded-2xl shadow-lg space-y-4 border-2 border-accent/20">
                  <h3 className="text-lg font-bold flex items-center gap-3 border-b border-white/20 pb-3"><Calculator className="w-5 h-5 text-accent" /> Récapitulatif du Paiement</h3>
                  <div className="flex justify-between items-center text-xl font-bold"><span>MONTANT TOTAL :</span><span className="text-3xl text-accent">{totalToPay} €</span></div>
                  <p className="text-xs italic opacity-90 flex items-start gap-2"><Info className="w-4 h-4 shrink-0" /> Chèque global à l'ordre de "Association Un Jardin pour Félix" à envoyer sous 15 jours.</p>
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full bg-secondary hover:bg-secondary/90 text-white h-16 text-xl font-bold shadow-lg transition-transform hover:scale-[1.02]">
                  {isSubmitting ? <><Loader2 className="animate-spin mr-2" /> Validation en cours...</> : "Finaliser mon inscription définitive"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}