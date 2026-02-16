"use client"
import React, { useEffect, useState } from 'react';
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
import { ShieldCheck, Zap, Utensils, Ticket, Camera, Info, ArrowLeft, Heart, CheckCircle2, Calculator, Mail, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { sendFinalConfirmationEmail } from '@/app/actions/email-actions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const formSchema = z.object({
  needsElectricity: z.boolean().default(false),
  sundayLunchCount: z.coerce.number().min(0, "Minimum 0").max(6, "Maximum 6 par stand"),
  tombolaLot: z.boolean().default(false),
  tombolaLotDescription: z.string().optional(),
  insuranceCompany: z.string().min(2, "Nom de l'assurance requis"),
  insurancePolicyNumber: z.string().min(5, "N° de police requis"),
  agreedToImageRights: z.boolean().refine(val => val === true, "L'acceptation est requise"),
  agreedToTerms: z.boolean().refine(val => val === true, "L'acceptation est requise"),
  additionalComments: z.string().optional(),
});

export default function DetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const logoUrl = "https://i.ibb.co/yncRPkvR/logo-ujpf.jpg";

  // Market Config fetching
  const marketConfigRef = useMemoFirebase(() => collection(db, 'market_configurations'), [db]);
  const { data: configs } = useCollection(marketConfigRef);
  const currentConfig = configs?.find(c => c.currentMarket) || configs?.[0];
  const currentYear = currentConfig?.marketYear || 2026;

  // Exhibitor fetching from Firestore
  const exhibitorRef = useMemoFirebase(() => id ? doc(db, 'pre_registrations', id as string) : null, [db, id]);
  const { data: exhibitor, isLoading: isExhibitorLoading } = useDoc<Exhibitor>(exhibitorRef);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      needsElectricity: false,
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
  const watchElectricity = form.watch("needsElectricity");
  
  const standPrice = exhibitor?.requestedTables === '1' ? 40 : 60;
  const mealsPrice = watchLunchCount * 8;
  const totalToPay = standPrice + mealsPrice;

  useEffect(() => {
    if (exhibitor?.detailedInfo) {
      form.reset({
        ...exhibitor.detailedInfo,
      });
    }
  }, [exhibitor, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!exhibitor) return;
    setIsSubmitting(true);
    
    try {
      // Save details to Firestore
      const detailId = exhibitor.id; // Using preRegistration ID as the detail ID for simplicity
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

      // Also update the pre-registration status
      const preRegRef = doc(db, 'pre_registrations', exhibitor.id);
      updateDocumentNonBlocking(preRegRef, { 
        status: 'submitted_form2',
        detailedInfo: values // Optional: keep a copy in the pre-reg doc for easier admin view
      });

      // Envoi de l'email de confirmation
      const emailResult = await sendFinalConfirmationEmail(exhibitor, values, currentConfig);
      
      if (!emailResult.success) {
        toast({
          variant: "destructive",
          title: "Erreur d'envoi",
          description: "Le dossier est enregistré mais l'email n'a pu être envoyé.",
        });
      }
      
      router.push('/register/success?type=final');
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Une erreur est survenue lors de la validation.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isExhibitorLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!exhibitor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center space-y-4">
        <ShieldCheck className="w-16 h-16 text-destructive" />
        <h1 className="text-2xl font-bold text-primary">Dossier introuvable</h1>
        <p className="text-muted-foreground">Ce lien est invalide ou la candidature n'a pas été acceptée.</p>
        <Button asChild variant="outline">
          <Link href="/">Retour à l'accueil</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 relative selection:bg-accent selection:text-accent-foreground">
      <ChristmasSnow />
      
      <div className="container mx-auto max-w-3xl relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-8 font-medium">
          <ArrowLeft className="w-4 h-4" /> Retour au site
        </Link>

        <Card className="border-t-8 border-t-primary shadow-2xl overflow-hidden bg-white/95 backdrop-blur-sm">
          <div className="bg-primary text-white p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-b">
            <div className="space-y-2 text-center md:text-left">
              <h1 className="text-3xl font-headline font-bold">Dossier de Finalisation</h1>
              <div className="flex flex-col gap-1">
                <p className="text-lg font-medium text-accent">Exposant : {exhibitor.companyName}</p>
                <p className="text-xs opacity-80 uppercase tracking-widest">Marché de Noël Solidaire {currentYear}</p>
              </div>
            </div>
            <div className="relative w-20 h-20 rounded-full border-4 border-white/20 overflow-hidden shadow-lg bg-white">
              <Image src={logoUrl} alt="Logo" fill className="object-cover" />
            </div>
          </div>
          
          <CardHeader className="bg-muted/30 py-8 border-b">
            <div className="flex items-start gap-4">
              <div className="bg-secondary/10 p-3 rounded-full text-secondary">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl font-headline font-bold text-primary">Confirmation de votre demande</CardTitle>
                <CardDescription className="text-base">
                  Votre candidature pour <strong>{exhibitor.requestedTables === '1' ? '1 table (1.75m)' : '2 tables (3.50m)'}</strong> a été retenue. 
                  Complétez les détails ci-dessous pour finaliser votre réservation.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
                
                <div className="space-y-6">
                  <h3 className="text-lg font-bold flex items-center gap-3 text-primary border-b pb-3">
                    <Zap className="w-5 h-5 text-secondary" /> Logistique & Énergie
                  </h3>
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl text-sm text-primary flex gap-4">
                    <Info className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p>
                        Emplacement réservé : <strong>{exhibitor.requestedTables === '1' ? '1.75m (1 table)' : '3.50m (2 tables)'}</strong>.
                      </p>
                      <p className="text-xs italic opacity-80">
                        L'électricité est facturée 1€ de supplément le jour de l'installation (limité en priorité aux produits alimentaires).
                      </p>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="needsElectricity"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-5 bg-white hover:bg-muted/10 transition-colors shadow-sm cursor-pointer">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-base font-bold">Besoin d'un raccordement électrique ?</FormLabel>
                          <FormDescription className="text-sm">
                            Attention : veuillez prévoir vos propres rallonges et multiprises (normes CE).
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-bold flex items-center gap-3 text-primary border-b pb-3">
                    <Utensils className="w-5 h-5 text-secondary" /> Restauration (Dimanche midi)
                  </h3>
                  <FormField
                    control={form.control}
                    name="sundayLunchCount"
                    render={({ field }) => (
                      <FormItem className="space-y-4">
                        <FormLabel className="text-base font-bold text-foreground">Nombre de plateaux repas souhaités (8€ / unité)</FormLabel>
                        <FormDescription className="text-sm">
                          Menu complet "Fait Maison" : Quiche, salade composée, fromage, dessert, eau.
                        </FormDescription>
                        <FormControl>
                          <div className="flex items-center gap-4">
                            <Input type="number" {...field} className="w-24 text-center text-lg font-bold border-2 border-primary/20 focus:border-primary h-12" />
                            <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Plateaux</span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-bold flex items-center gap-3 text-primary border-b pb-3">
                    <Ticket className="w-5 h-5 text-secondary" /> Action Solidaire : Tombola
                  </h3>
                  <FormField
                    control={form.control}
                    name="tombolaLot"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-5 bg-white hover:bg-muted/10 transition-colors shadow-sm cursor-pointer">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-base font-bold">Je souhaite offrir un lot pour la tombola de l'association</FormLabel>
                          <FormDescription className="text-sm">
                            Votre générosité aide directement Félix. Le lot sera collecté sur votre stand le samedi après-midi.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  {form.watch("tombolaLot") && (
                    <FormField
                      control={form.control}
                      name="tombolaLotDescription"
                      render={({ field }) => (
                        <FormItem className="animate-in fade-in slide-in-from-top-2">
                          <FormLabel className="text-sm font-bold">Nature du lot (ex: Bougie, Bijou, Bon d'achat...)</FormLabel>
                          <FormControl>
                            <Input placeholder="Précisez ici..." {...field} className="border-2 border-primary/10 h-11" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-bold flex items-center gap-3 text-primary border-b pb-3">
                    <ShieldCheck className="w-5 h-5 text-secondary" /> Responsabilité Civile (Obligatoire)
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="insuranceCompany"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-bold">Compagnie d'Assurance</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: AXA, MAIF, MMA..." {...field} className="h-11 border-primary/10" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="insurancePolicyNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-bold">Numéro de Contrat (Police)</FormLabel>
                          <FormControl>
                            <Input placeholder="N° de contrat" {...field} className="h-11 border-primary/10" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4 p-6 bg-secondary/5 rounded-2xl border border-secondary/10">
                  <FormField
                    control={form.control}
                    name="agreedToImageRights"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="flex items-center gap-2 font-bold text-sm text-primary">
                            <Camera className="w-4 h-4" /> Droit à l'image
                          </FormLabel>
                          <FormDescription className="text-xs text-primary/70">
                            J'autorise l'association à utiliser des photos de mon stand pour sa communication.
                          </FormDescription>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                  <div className="h-px bg-primary/10 my-2" />
                  <FormField
                    control={form.control}
                    name="agreedToTerms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-bold text-sm text-primary">Acceptation définitive du Règlement</FormLabel>
                          <FormDescription className="text-xs text-primary/70">
                            Je confirme avoir lu et accepté l'intégralité du règlement intérieur {currentYear}.
                          </FormDescription>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="p-6 bg-primary text-white rounded-2xl shadow-lg space-y-4 border-2 border-accent/20">
                  <h3 className="text-lg font-bold flex items-center gap-3 border-b border-white/20 pb-3">
                    <Calculator className="w-5 h-5 text-accent" /> Récapitulatif de votre règlement
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span>Emplacement ({exhibitor.requestedTables === '1' ? '1 table' : '2 tables'}) :</span>
                      <span className="font-bold">{standPrice} €</span>
                    </div>
                    {watchLunchCount > 0 && (
                      <div className="flex justify-between items-center">
                        <span>Repas Dimanche ({watchLunchCount} x 8€) :</span>
                        <span className="font-bold">{mealsPrice} €</span>
                      </div>
                    )}
                    {watchElectricity && (
                      <div className="flex justify-between items-center text-accent text-xs italic">
                        <span>Option Électricité (à régler sur place) :</span>
                        <span className="font-bold">1 €</span>
                      </div>
                    )}
                  </div>
                  <div className="pt-3 border-t border-white/40 flex justify-between items-center">
                    <span className="text-xl font-headline font-bold">TOTAL À ENVOYER :</span>
                    <span className="text-3xl font-headline font-bold text-accent">{totalToPay} €</span>
                  </div>
                  <div className="bg-white/10 p-3 rounded-lg flex items-start gap-3 text-xs">
                    <Mail className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>Chèque à libeller à l'ordre de <strong>"Association Un Jardin pour Félix"</strong> et à envoyer par courrier.</p>
                  </div>
                </div>

                <div className="pt-6 space-y-6">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-secondary hover:bg-secondary/90 text-white h-16 text-xl gold-glow font-bold shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] border-none"
                  >
                    {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Valider définitivement mon inscription"}
                  </Button>
                  
                  <div className="text-center space-y-2">
                    <p className="flex items-center justify-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
                      <Heart className="w-4 h-4 fill-primary" /> Merci pour votre soutien à Félix
                    </p>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}