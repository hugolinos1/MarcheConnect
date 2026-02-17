
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

function FinalizationForm({ exhibitor, currentConfig }: { exhibitor: Exhibitor; currentConfig: any }) {
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const priceTable1 = currentConfig?.priceTable1 ?? 40;
  const priceTable2 = currentConfig?.priceTable2 ?? 60;
  const priceMeal = currentConfig?.priceMeal ?? 8;
  const priceElectricity = currentConfig?.priceElectricity ?? 1;

  const formSchema = useMemo(() => {
    const isPro = exhibitor.isRegistered === true;
    return z.object({
      siret: isPro 
        ? z.string().min(9, "Le SIRET est obligatoire pour les professionnels")
        : z.string().optional(),
      idCardPhoto: z.string().min(1, "La photo de la pièce d'identité est requise"),
      needsElectricity: z.boolean().default(false),
      needsGrid: z.boolean().default(false),
      sundayLunchCount: z.coerce.number().min(0, "Minimum 0").max(6, "Maximum 6 par stand"),
      tombolaLot: z.boolean().default(false),
      tombolaLotDescription: z.string().optional(),
      insuranceCompany: z.string().min(2, "Nom de l'assurance requis"),
      insurancePolicyNumber: z.string().min(5, "N° de police requis"),
      agreedToImageRights: z.boolean().refine(val => val === true, "L'acceptation est requise"),
      agreedToTerms: z.boolean().refine(val => val === true, "L'acceptation est requise"),
      additionalComments: z.string().optional(),
    });
  }, [exhibitor.isRegistered]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      siret: exhibitor.detailedInfo?.siret || "",
      idCardPhoto: exhibitor.detailedInfo?.idCardPhoto || "",
      needsElectricity: exhibitor.detailedInfo?.needsElectricity || false,
      needsGrid: exhibitor.detailedInfo?.needsGrid || false,
      sundayLunchCount: exhibitor.detailedInfo?.sundayLunchCount || 0,
      tombolaLot: exhibitor.detailedInfo?.tombolaLot ?? true,
      tombolaLotDescription: exhibitor.detailedInfo?.tombolaLotDescription || "",
      insuranceCompany: exhibitor.detailedInfo?.insuranceCompany || "",
      insurancePolicyNumber: exhibitor.detailedInfo?.insurancePolicyNumber || "",
      agreedToImageRights: exhibitor.detailedInfo?.agreedToImageRights || false,
      agreedToTerms: exhibitor.detailedInfo?.agreedToTerms || false,
      additionalComments: exhibitor.detailedInfo?.additionalComments || "",
    },
  });

  const watchLunchCount = form.watch("sundayLunchCount") || 0;
  const idCardPhoto = form.watch("idCardPhoto");
  
  const standPrice = exhibitor.requestedTables === '1' ? priceTable1 : priceTable2;
  const mealsPrice = watchLunchCount * priceMeal;
  const totalToPay = standPrice + mealsPrice;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingImage(true);
    const file = files[0];

    const compressImage = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new (window as any).Image();
          img.src = event.target?.result;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1000;
            const MAX_HEIGHT = 1000;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.5));
          };
        };
      });
    };

    try {
      const compressed = await compressImage(file);
      form.setValue('idCardPhoto', compressed);
    } catch (err) {
      console.error("Compression error:", err);
    } finally {
      setIsProcessingImage(false);
      e.target.value = '';
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const detailId = exhibitor.id;
      const detailRef = doc(db, 'exhibitor_details', detailId);
      const detailedData = {
        ...values,
        id: detailId,
        preRegistrationId: exhibitor.id,
        marketConfigurationId: currentConfig?.id || 'default',
        submissionDate: new Date().toISOString(),
        adminValidationStatus: 'PENDING_REVIEW'
      };
      setDocumentNonBlocking(detailRef, detailedData, { merge: true });
      const preRegRef = doc(db, 'pre_registrations', exhibitor.id);
      updateDocumentNonBlocking(preRegRef, { 
        status: 'submitted_form2',
        detailedInfo: values
      });
      await sendFinalConfirmationEmail(exhibitor, values, currentConfig);
      router.push('/register/success?type=final');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue lors de la validation du dossier.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
        <div className="space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-3 text-primary border-b pb-3">
            <FileText className="w-5 h-5 text-secondary" /> Administratif
          </h3>
          {exhibitor.isRegistered && (
            <FormField
              control={form.control}
              name="siret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-bold">Numéro de SIRET <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="14 chiffres" {...field} className="h-11 border-primary/10" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="idCardPhoto"
            render={() => (
              <FormItem className="space-y-4">
                <FormLabel className="text-sm font-bold">Photo de votre pièce d'identité (Recto) <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <div className="flex flex-col gap-4">
                    {idCardPhoto ? (
                      <div className="relative aspect-video max-w-sm rounded-lg overflow-hidden border shadow-sm group bg-muted">
                        <img src={idCardPhoto} alt="Pièce d'identité" className="w-full h-full object-contain" />
                        <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100" onClick={() => form.setValue('idCardPhoto', '')}><X className="w-4 h-4" /></Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center aspect-video max-w-sm rounded-lg border-2 border-dashed border-primary/20 bg-primary/5 hover:bg-primary/10 cursor-pointer transition-all">
                        {isProcessingImage ? <Loader2 className="w-8 h-8 animate-spin text-primary" /> : <><Camera className="w-10 h-10 text-primary mb-2" /><span className="text-sm font-bold text-primary">Charger</span></>}
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isProcessingImage} />
                      </label>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-3 text-primary border-b pb-3"><Zap className="w-5 h-5 text-secondary" /> Logistique & Énergie</h3>
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl text-sm text-primary flex gap-4">
            <Info className="w-5 h-5 shrink-0 mt-0.5" />
            <p>Emplacement réservé : <strong>{exhibitor.requestedTables === '1' ? '1.75m (1 table)' : '3.50m (2 tables)'}</strong>.</p>
          </div>
          <FormField
            control={form.control}
            name="needsElectricity"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-5 bg-white shadow-sm">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <div className="space-y-1 leading-none"><FormLabel className="text-base font-bold">Besoin d'un raccordement électrique ?</FormLabel></div>
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-3 text-primary border-b pb-3"><Utensils className="w-5 h-5 text-secondary" /> Restauration</h3>
          <FormField
            control={form.control}
            name="sundayLunchCount"
            render={({ field }) => (
              <FormItem className="space-y-4">
                <FormLabel className="text-base font-bold">Plateaux repas souhaités ({priceMeal}€ / unité)</FormLabel>
                <FormControl><Input type="number" {...field} className="w-24 text-center h-12" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-3 text-primary border-b pb-3"><ShieldCheck className="w-5 h-5 text-secondary" /> Assurance</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="insuranceCompany"
              render={({ field }) => (
                <FormItem><FormLabel>Compagnie d'Assurance</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="insurancePolicyNumber"
              render={({ field }) => (
                <FormItem><FormLabel>Numéro de Contrat</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}
            />
          </div>
        </div>

        <div className="p-6 bg-primary text-white rounded-2xl shadow-lg space-y-4">
          <div className="pt-3 flex justify-between items-center">
            <span className="text-xl font-bold">TOTAL À RÉGLER :</span>
            <span className="text-3xl font-bold text-accent">{totalToPay} €</span>
          </div>
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full h-16 text-xl font-bold">
          {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Valider mon inscription"}
        </Button>
      </form>
    </Form>
  );
}

export default function DetailsPage() {
  const { id } = useParams();
  const db = useFirestore();

  const marketConfigRef = useMemoFirebase(() => collection(db, 'market_configurations'), [db]);
  const { data: configs } = useCollection(marketConfigRef);
  const currentConfig = configs?.find(c => c.currentMarket) || configs?.[0];

  const exhibitorRef = useMemoFirebase(() => id ? doc(db, 'pre_registrations', id as string) : null, [db, id]);
  const { data: exhibitor, isLoading: isExhibitorLoading } = useDoc<Exhibitor>(exhibitorRef);

  if (isExhibitorLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  if (!exhibitor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center space-y-4">
        <h1 className="text-2xl font-bold text-primary">Dossier introuvable</h1>
        <Button asChild variant="outline"><Link href="/">Retour à l'accueil</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 relative">
      <ChristmasSnow />
      <div className="container mx-auto max-w-3xl relative z-10">
        <Card className="border-t-8 border-t-primary shadow-2xl overflow-hidden bg-white/95 backdrop-blur-sm">
          <div className="bg-primary text-white p-8">
            <h1 className="text-3xl font-bold">Dossier de Finalisation</h1>
            <p className="text-lg opacity-90 mt-2">Exposant : {exhibitor.companyName}</p>
          </div>
          <CardContent className="p-8">
            <FinalizationForm exhibitor={exhibitor} currentConfig={currentConfig} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
