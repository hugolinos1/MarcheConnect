
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
import { TreePine, ShieldCheck, Zap, Maximize } from 'lucide-react';

const formSchema = z.object({
  boothSize: z.string().min(1, "Veuillez choisir une taille"),
  needsElectricity: z.boolean().default(false),
  electricityPower: z.string().optional(),
  insuranceCompany: z.string().min(2, "Nom de l'assurance requis"),
  insurancePolicyNumber: z.string().min(5, "N° de police requis"),
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
      boothSize: "",
      needsElectricity: false,
      electricityPower: "1kW",
      insuranceCompany: "",
      insurancePolicyNumber: "",
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
              <p className="text-sm opacity-90">Pour {exhibitor.companyName}</p>
            </div>
            <TreePine className="w-10 h-10 opacity-50" />
          </div>
          
          <CardHeader>
            <CardTitle className="text-xl font-headline font-bold text-primary">Informations Administratives & Logistiques</CardTitle>
            <CardDescription>Veuillez compléter ces informations pour valider définitivement votre emplacement.</CardDescription>
          </CardHeader>
          
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Logistique */}
                <div className="space-y-4">
                  <h3 className="font-bold flex items-center gap-2 text-secondary">
                    <Maximize className="w-4 h-4" /> Besoins Logistiques
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="boothSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Taille du stand souhaitée</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Choisir une taille" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="3x3">Chalet Standard (3m x 3m)</SelectItem>
                              <SelectItem value="6x3">Double Chalet (6m x 3m)</SelectItem>
                              <SelectItem value="foodtruck">Emplacement Foodtruck</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="needsElectricity"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Besoin d'électricité ?</FormLabel>
                              <FormDescription>Cochez si vous avez besoin d'un raccordement.</FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      {form.watch("needsElectricity") && (
                        <FormField
                          control={form.control}
                          name="electricityPower"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Puissance souhaitée</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="1kW">1 kW (Éclairage uniquement)</SelectItem>
                                  <SelectItem value="3kW">3 kW (Petit matériel)</SelectItem>
                                  <SelectItem value="9kW">9 kW (Cuisson / Froid)</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Assurance */}
                <div className="space-y-4">
                  <h3 className="font-bold flex items-center gap-2 text-secondary">
                    <ShieldCheck className="w-4 h-4" /> Assurance Responsabilité Civile
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

                <FormField
                  control={form.control}
                  name="additionalComments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commentaires ou besoins spécifiques</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Précisez ici vos éventuelles contraintes..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full bg-secondary hover:bg-secondary/90 text-white h-12 text-lg gold-glow font-bold">
                  Finaliser mon dossier
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
