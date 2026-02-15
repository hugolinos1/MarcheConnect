
"use client"
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Exhibitor } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { TreePine, ShieldCheck, Zap, Utensils, Ticket, Camera, Info } from 'lucide-react';

const formSchema = z.object({
  needsElectricity: z.boolean().default(false),
  sundayLunchCount: z.coerce.number().min(0, "Minimum 0").max(4, "Maximum 4 par stand"),
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
  const [exhibitor, setExhibitor] = useState<Exhibitor | null>(null);

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('exhibitors') || '[]');
    const found = data.find((e: any) => e.id === id);
    if (!found || found.status !== 'accepted_form1') {
      router.push('/');
    } else {
      setExhibitor(found);
    }
  }, [id, router]);

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

  function onSubmit(values: z.infer<typeof formSchema>) {
    const data = JSON.parse(localStorage.getItem('exhibitors') || '[]');
    const updated = data.map((e: any) => 
      e.id === id ? { 
        ...e, 
        status: 'submitted_form2', 
        detailedInfo: { ...values, submittedAt: new Date().toISOString() } 
      } : e
    );
    localStorage.setItem('exhibitors', JSON.stringify(updated));
    router.push('/register/success');
  }

  if (!exhibitor) return null;

  return (
    <div className="min-h-screen bg-background py-12 px-4 relative">
      <ChristmasSnow />
      <div className="container mx-auto max-w-3xl relative z-10">
        <Card className="border-t-4 border-t-secondary shadow-xl overflow-hidden">
          <div className="bg-secondary text-white p-6 flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-headline font-bold">Dossier de Finalisation</h1>
              <p className="text-sm opacity-90">Exposant : {exhibitor.companyName}</p>
            </div>
            <TreePine className="w-10 h-10 opacity-50" />
          </div>
          
          <CardHeader>
            <CardTitle className="text-xl font-headline font-bold text-primary">Informations Logistiques & Administratives</CardTitle>
            <CardDescription>
              Votre candidature pour {exhibitor.requestedTables === '1' ? '1 table' : '2 tables'} a été retenue. 
              Merci de compléter ces derniers détails.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
                
                {/* Logistique & Electricité */}
                <div className="space-y-4">
                  <h3 className="font-bold flex items-center gap-2 text-secondary border-b pb-2">
                    <Zap className="w-4 h-4" /> Électricité & Tables
                  </h3>
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800 flex gap-3">
                    <Info className="w-5 h-5 shrink-0" />
                    <p>
                      Nombre de tables réservées : <strong>{exhibitor.requestedTables}</strong>. 
                      L'électricité est facturée 1€ de supplément le jour J (limité aux produits alimentaires en priorité).
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name="needsElectricity"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-white shadow-sm">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Besoin d'un raccordement électrique ?</FormLabel>
                          <FormDescription>Prévoir vos rallonges. Confirmation début novembre.</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Restauration */}
                <div className="space-y-4">
                  <h3 className="font-bold flex items-center gap-2 text-secondary border-b pb-2">
                    <Utensils className="w-4 h-4" /> Restauration (Dimanche midi)
                  </h3>
                  <FormField
                    control={form.control}
                    name="sundayLunchCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de plateaux repas (8€ / unité)</FormLabel>
                        <FormDescription>Fait maison : quiche, salade, fromage, dessert, eau.</FormDescription>
                        <FormControl>
                          <Input type="number" {...field} className="w-24" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Tombola */}
                <div className="space-y-4">
                  <h3 className="font-bold flex items-center gap-2 text-secondary border-b pb-2">
                    <Ticket className="w-4 h-4" /> Action Solidaire : Tombola
                  </h3>
                  <FormField
                    control={form.control}
                    name="tombolaLot"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-white shadow-sm">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Je souhaite offrir un lot pour la tombola</FormLabel>
                          <FormDescription>Don au profit de l'association (au bon vouloir de chacun).</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  {form.watch("tombolaLot") && (
                    <FormField
                      control={form.control}
                      name="tombolaLotDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nature du lot (optionnel)</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Un bijou, une pochette en tissu..." {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Assurance */}
                <div className="space-y-4">
                  <h3 className="font-bold flex items-center gap-2 text-secondary border-b pb-2">
                    <ShieldCheck className="w-4 h-4" /> Responsabilité Civile
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="insuranceCompany"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Compagnie d'Assurance</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: AXA, MMA..." {...field} />
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
                          <FormLabel>Numéro de Police</FormLabel>
                          <FormControl>
                            <Input placeholder="N° de contrat" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Consentements */}
                <div className="space-y-4 p-4 bg-muted/20 rounded-lg">
                  <FormField
                    control={form.control}
                    name="agreedToImageRights"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="flex items-center gap-2">
                            <Camera className="w-3 h-3" /> Droits à l'image (Art. 7)
                          </FormLabel>
                          <FormDescription className="text-[10px]">
                            J'accepte la diffusion gratuite de vues de mon stand pour la communication.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="agreedToTerms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-bold">Acceptation du Règlement (Art. 1 à 9)</FormLabel>
                          <FormDescription className="text-[10px]">
                            Je déclare avoir pris connaissance des conditions d'assurance et des obligations.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="additionalComments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commentaires finaux</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Précisez ici vos éventuels besoins spécifiques..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full bg-secondary hover:bg-secondary/90 text-white h-12 text-lg gold-glow font-bold">
                  Valider définitivement mon inscription
                </Button>
                
                <p className="text-center text-xs text-muted-foreground">
                  Le chèque de règlement (40€ ou 60€ + repas) devra être envoyé pour valider l'inscription.
                </p>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
