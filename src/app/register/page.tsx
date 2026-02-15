
"use client"
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { TreePine, ArrowLeft, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const formSchema = z.object({
  name: z.string().min(2, "Le nom est requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(10, "Numéro de téléphone requis"),
  companyName: z.string().min(2, "Nom de l'entreprise requis"),
  productDescription: z.string().min(10, "Veuillez décrire vos produits (min 10 caractères)"),
});

export default function RegisterPage() {
  const router = useRouter();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      companyName: "",
      productDescription: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // In a real app, we'd save this to a DB.
    // For this demo, we'll store it in localStorage and redirect.
    const newExhibitor = {
      ...values,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    
    const existing = JSON.parse(localStorage.getItem('exhibitors') || '[]');
    localStorage.setItem('exhibitors', JSON.stringify([...existing, newExhibitor]));
    
    router.push('/register/success');
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 relative overflow-hidden">
      <ChristmasSnow />
      <div className="container mx-auto max-w-2xl relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-8 font-medium">
          <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
        </Link>
        
        <Card className="border-t-4 border-t-primary shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              <TreePine className="w-8 h-8" />
            </div>
            <div>
              <CardTitle className="text-3xl font-headline font-bold text-primary">Candidature Exposant</CardTitle>
              <CardDescription className="text-lg">Étape 1 : Présentation de votre projet</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Votre Nom & Prénom</FormLabel>
                        <FormControl>
                          <Input placeholder="Jean Dupont" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom de votre Enseigne</FormLabel>
                        <FormControl>
                          <Input placeholder="Les Artisans de Noël" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email professionnel</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="contact@votre-boutique.fr" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone</FormLabel>
                        <FormControl>
                          <Input placeholder="06 01 02 03 04" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="productDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description de vos produits / concept</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Décrivez ce que vous souhaitez vendre, vos matières premières, votre univers..." 
                          className="min-h-[120px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>Ces informations permettront au jury de statuer sur votre candidature.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white gold-glow h-12 text-lg font-semibold gap-2">
                  <Send className="w-5 h-5" /> Envoyer ma pré-inscription
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
