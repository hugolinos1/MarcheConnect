'use client';

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
import { Card, CardContent } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { ShieldCheck, Zap, Utensils, Camera, ArrowLeft, Calculator, Loader2, FileText, X, LayoutGrid, Gift, MessageSquare } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { sendFinalConfirmationEmail } from '@/app/actions/email-actions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';

function FinalizationForm({ exhibitor, currentConfig }: { exhibitor: Exhibitor; currentConfig: any }) {
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const formSchema = useMemo(() => {
    return z.object({
      siret: z.string().optional(),
      idCardPhoto: z.string().min(1, "La photo de la pièce d'identité est obligatoire"),
      needsElectricity: z.boolean().default(false),
      needsGrid: z.boolean().default(false),
      sundayLunchCount: z.coerce.number().min(0).max(10),
      tombolaLot: z.boolean().default(true),
      tombolaLotDescription: z.string().optional(),
      insuranceCompany: z.string().optional(),
      insurancePolicyNumber: z.string().optional(),
      agreedToImageRights: z.boolean().refine(val => val === true, "Requis"),
      agreedToTerms: z.boolean().refine(val => val === true, "Requis"),
      additionalComments: z.string().optional(),
    });
  }, []);

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
  const watchNeedsElectricity = form.watch("needsElectricity") || false;
  const watchTombolaLot = form.watch("tombolaLot");
  const idCardPhoto = form.watch("idCardPhoto");
  
  const standPrice = exhibitor?.requestedTables === '1' ? (currentConfig?.priceTable1 ?? 40) : (currentConfig?.priceTable2 ?? 60);
  const electricityPrice = watchNeedsElectricity ? (currentConfig?.priceElectricity ?? 1) : 0;
  const mealsPrice = watchLunchCount * (currentConfig?.priceMeal ?? 8);
  const totalToPay = standPrice + electricityPrice + mealsPrice;

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
        form.setValue('idCardPhoto', canvas.toDataURL('image/jpeg', 0.7), { shouldValidate: true });
        setIsProcessingImage(false);
      };
    };
    reader.readAsDataURL(file);
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
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
      
      setDocumentNonBlocking(doc(db, 'exhibitor_details', exhibitor.id), detailedData, { merge: true });
      updateDocumentNonBlocking(doc(db, 'pre_registrations', exhibitor.id), { 
        status: 'submitted_form2',
        detailedInfo: detailedData
      });

      await sendFinalConfirmationEmail(exhibitor, values, currentConfig);
      
      toast({ title: "Dossier enregistré !", description: "Merci pour votre finalisation." });
      setTimeout(() => router.push('/register/success?type=final'), 1000);
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur technique lors de l'enregistrement" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <ChristmasSnow />
      <div className="container mx-auto max-w-3xl relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-8 font-medium"><ArrowLeft className="w-4 h-4" /> Retour au site</Link>
        <Card className="border-t-8 border-t-primary shadow-2xl overflow-hidden bg-white/95">
          <div className="bg-primary text-white p-8 flex items-center justify-between gap-6">
            <div><h1 className="text-2xl font-bold">Dossier Technique</h1><p className="text-accent">{exhibitor?.companyName}</p></div>
            <img src="https://i.ibb.co/yncRPkvR/logo-ujpf.jpg" alt="Logo" className="w-16 h-16 rounded-full" />
          </div>
          <CardContent className="p-4 md:p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
                <div className="space-y-6">
                  <h3 className="text-lg font-bold border-b pb-3 flex items-center gap-3 text-primary"><FileText className="w-5 h-5" /> Administratif</h3>
                  {exhibitor?.isRegistered && (
                    <FormField control={form.control} name="siret" render={({ field }) => (
                      <FormItem><FormLabel>SIRET</FormLabel><FormControl><Input placeholder="14 chiffres" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  )}
                  <FormField control={form.control} name="idCardPhoto" render={() => (
                    <FormItem>
                      <FormLabel>Pièce d'identité (Recto) *</FormLabel>
                      <FormControl>
                        <div className="flex flex-col gap-4">
                          {idCardPhoto ? (
                            <div className="relative aspect-video max-w-sm rounded-lg overflow-hidden border bg-muted">
                              <img src={idCardPhoto} alt="ID" className="w-full h-full object-contain" />
                              <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2" onClick={() => form.setValue('idCardPhoto', '')}><X className="w-4 h-4" /></Button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center aspect-video max-w-sm rounded-lg border-2 border-dashed border-primary/20 bg-primary/5 cursor-pointer">
                              {isProcessingImage ? <Loader2 className="animate-spin" /> : <Camera className="w-10 h-10 text-primary/50" />}
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
                  <h3 className="text-lg font-bold border-b pb-3 flex items-center gap-3 text-primary"><Zap className="w-5 h-5" /> Logistique</h3>
                  <div className="grid gap-4">
                    <FormField control={form.control} name="needsElectricity" render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 p-4 border rounded-xl">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div>
                          <FormLabel className="font-bold">Electricité ?</FormLabel>
                          <FormDescription>Supplément de {currentConfig?.priceElectricity ?? 1}€.</FormDescription>
                        </div>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="needsGrid" render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 p-4 border rounded-xl">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div>
                          <FormLabel className="font-bold flex items-center gap-2"><LayoutGrid className="w-4 h-4" /> Besoin d'une grille d'exposition ?</FormLabel>
                          <FormDescription>Gratuit (sous réserve de disponibilité).</FormDescription>
                        </div>
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-bold border-b pb-3 flex items-center gap-3 text-primary"><Utensils className="w-5 h-5" /> Restauration</h3>
                  <FormField control={form.control} name="sundayLunchCount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de plateaux repas ({currentConfig?.priceMeal ?? 8}€)</FormLabel>
                      <FormDescription>Le dimanche midi (fait maison).</FormDescription>
                      <FormControl>
                        <Input type="number" {...field} className="w-24" />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-bold border-b pb-3 flex items-center gap-3 text-primary"><Gift className="w-5 h-5" /> Tombola solidaire</h3>
                  <div className="space-y-4">
                    <FormField control={form.control} name="tombolaLot" render={({ field }) => (
                      <FormItem className="flex items-start space-x-3 p-4 border rounded-xl">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div>
                          <FormLabel className="font-bold">Je souhaite offrir un lot pour la tombola</FormLabel>
                          <FormDescription>Un lot mettant en avant votre savoir-faire artisanal.</FormDescription>
                        </div>
                      </FormItem>
                    )} />
                    
                    {watchTombolaLot && (
                      <FormField control={form.control} name="tombolaLotDescription" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nature du lot offert</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Ex: Un bijou en argent, un pot de miel, une décoration..." {...field} />
                          </FormControl>
                        </FormItem>
                      )} />
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-bold border-b pb-3 flex items-center gap-3 text-primary"><ShieldCheck className="w-5 h-5" /> Assurance RC</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="insuranceCompany" render={({ field }) => (
                      <FormItem><FormLabel>Compagnie</FormLabel><Input {...field} /></FormItem>
                    )} />
                    <FormField control={form.control} name="insurancePolicyNumber" render={({ field }) => (
                      <FormItem><FormLabel>N° Contrat</FormLabel><Input {...field} /></FormItem>
                    )} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold border-b pb-3 flex items-center gap-3 text-primary"><MessageSquare className="w-5 h-5" /> Commentaires libres</h3>
                  <FormField control={form.control} name="additionalComments" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea placeholder="Besoin spécifique, question, précision..." {...field} />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-4 p-4 bg-muted/20 rounded-xl border">
                   <FormField control={form.control} name="agreedToImageRights" render={({ field }) => (
                    <FormItem className="flex items-start space-x-3 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1"><FormLabel className="font-bold">Droit à l'image *</FormLabel><FormDescription className="text-xs">J'accepte que des vues de mon stand soient diffusées pour la communication de l'événement.</FormDescription><FormMessage /></div></FormItem>
                  )} />
                   <FormField control={form.control} name="agreedToTerms" render={({ field }) => (
                    <FormItem className="flex items-start space-x-3 space-y-0 border-t pt-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1"><FormLabel className="font-bold">Acceptation du règlement *</FormLabel><FormDescription className="text-xs">J'accepte l'intégralité du règlement du marché.</FormDescription><FormMessage /></div></FormItem>
                  )} />
                </div>

                <div className="p-6 bg-primary text-white rounded-2xl shadow-lg space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-3 border-b border-white/20 pb-3"><Calculator className="w-5 h-5" /> Récapitulatif du règlement</h3>
                  <div className="space-y-2 text-sm opacity-90">
                    <div className="flex justify-between">
                      <span>Emplacement ({exhibitor?.requestedTables === '1' ? '1.75m' : '3.50m'}) :</span>
                      <span>{standPrice} €</span>
                    </div>
                    {watchNeedsElectricity && (
                      <div className="flex justify-between">
                        <span>Option Électricité :</span>
                        <span>{electricityPrice} €</span>
                      </div>
                    )}
                    {watchLunchCount > 0 && (
                      <div className="flex justify-between">
                        <span>Plateaux Repas ({watchLunchCount} x {currentConfig?.priceMeal ?? 8}€) :</span>
                        <span>{mealsPrice} €</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-xl font-bold border-t border-white/20 pt-3">
                    <span>MONTANT TOTAL :</span>
                    <span className="text-3xl text-accent">{totalToPay} €</span>
                  </div>
                  <p className="text-[10px] text-center italic opacity-80 pt-2">
                    Le paiement s'effectue par chèque à l'ordre de "Un jardin pour Félix".
                  </p>
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full bg-secondary text-white h-16 text-xl font-bold gold-glow">
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "Finaliser mon inscription"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
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
  if (!exhibitor) return <div className="min-h-screen flex items-center justify-center p-4"><p>Dossier introuvable</p></div>;

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 relative">
      <ChristmasSnow />
      <div className="max-w-2xl mx-auto relative z-10">
        <FinalizationForm exhibitor={exhibitor} currentConfig={currentConfig} />
      </div>
    </div>
  );
}
