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
import { TreePine, ArrowLeft, Send, Info, FileText, Heart, Star, Globe, ShieldCheck } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Image from 'next/image';

const formSchema = z.object({
  name: z.string().min(2, "Le nom est requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(10, "Numéro de téléphone requis"),
  companyName: z.string().min(2, "Nom de l'enseigne requis"),
  productDescription: z.string().min(10, "Veuillez décrire vos produits (nature du stand)"),
  origin: z.string().min(2, "Veuillez préciser votre origine géographique"),
  isRegistered: z.enum(["yes", "no"], { required_error: "Veuillez répondre à cette question" }),
  websiteUrl: z.string().optional(),
  requestedTables: z.enum(["1", "2"]),
  agreedToGdpr: z.boolean().refine(val => val === true, "L'acceptation de la politique de protection des données est requise"),
});

export default function RegisterPage() {
  const router = useRouter();
  const logoUrl = "https://i.ibb.co/yncRPkvR/logo-ujpf.jpg";
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      companyName: "",
      productDescription: "",
      origin: "",
      isRegistered: "yes",
      websiteUrl: "",
      requestedTables: "1",
      agreedToGdpr: false,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const newExhibitor = {
      ...values,
      isRegistered: values.isRegistered === "yes",
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    
    const existing = JSON.parse(localStorage.getItem('exhibitors') || '[]');
    localStorage.setItem('exhibitors', JSON.stringify([...existing, newExhibitor]));
    
    router.push('/register/success');
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 relative overflow-hidden text-foreground">
      <ChristmasSnow />
      <div className="container mx-auto max-w-4xl relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-8 font-medium">
          <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
        </Link>
        
        {/* Présentation Association */}
        <Card className="mb-8 border-l-4 border-l-secondary shadow-lg overflow-hidden">
          <div className="bg-secondary/5 p-6 border-b flex flex-col md:flex-row items-center gap-6">
            <div className="relative w-28 h-28 shrink-0 overflow-hidden rounded-full border-4 border-white shadow-md">
              <Image 
                src={logoUrl}
                alt="Logo Un Jardin pour Félix"
                fill
                className="object-cover"
              />
            </div>
            <div className="text-center md:text-left">
              <CardTitle className="text-2xl text-secondary font-headline mb-1">Un Jardin pour Félix</CardTitle>
              <CardDescription className="text-base font-medium">Marché de Noël Solidaire - Chazay d'Azergues</CardDescription>
            </div>
          </div>
          <CardContent className="pt-6 text-sm space-y-4 text-muted-foreground leading-relaxed">
            <p>
              L’association « Un jardin pour Félix » a été créé en 2014 par les parents de Félix. Il est atteint d’une maladie génétique rare le syndrome POTOCKI LUPSKI et d’un trouble autistique très envahissant. 
              L’association permet de financer des intervenants à domicile pour le stimuler et le faire progresser.
            </p>
            <p className="font-semibold text-foreground italic border-l-2 border-accent pl-4 py-1">
              "C’est notre 6ème édition, notre marché commence à avoir une belle réputation autour de Lyon ouest, c’est pourquoi nous devenons plus sélectives sur le choix des exposants. Nous privilégions l'artisanat et le fait-main."
            </p>
          </CardContent>
        </Card>

        {/* Règlement et RGPD */}
        <div className="grid gap-4 mb-8">
          <Accordion type="single" collapsible className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <AccordionItem value="reglement" className="border-none">
              <AccordionTrigger className="px-6 hover:no-underline hover:bg-muted/50 text-left">
                <span className="flex items-center gap-2 font-bold text-primary">
                  <FileText className="w-5 h-5" /> Règlement du Marché 2026
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 text-xs text-muted-foreground space-y-4 max-h-96 overflow-y-auto">
                <div>
                  <h4 className="font-bold text-foreground">Article 1 : Dates & Lieu</h4>
                  <p>Samedi 5/12/2026 (14h-19h) et Dimanche 6/12/2026 (10h-17h30). Salle Maurice Baquet, Chazay d’Azergues.</p>
                </div>
                <div>
                  <h4 className="font-bold text-foreground">Article 3 : Sélection</h4>
                  <p>Réponse sous 15 semaines. Nous privilégions le fait-main. Pas de revente. Tables de 1m75 fournies. Installation le samedi entre 11h et 13h.</p>
                </div>
                <div>
                  <h4 className="font-bold text-foreground">Article 5 : Tarifs & Restauration</h4>
                  <p>40€ pour 1 table (1m75), 60€ pour 2 tables (3m50). Repas du dimanche midi : 8€/personne.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Accordion type="single" collapsible className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <AccordionItem value="rgpd" className="border-none">
              <AccordionTrigger className="px-6 hover:no-underline hover:bg-muted/50 text-left">
                <span className="flex items-center gap-2 font-bold text-primary">
                  <ShieldCheck className="w-5 h-5" /> Protection de vos données (RGPD)
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6 text-xs text-muted-foreground space-y-4">
                <p>
                  Les informations recueillies sur ce formulaire sont enregistrées dans un fichier informatisé par <strong>l'Association Les Amis d'un Jardin pour Félix</strong> pour la gestion des candidatures et de l'organisation du marché de Noël.
                </p>
                <p>
                  Elles sont conservées pendant une durée de <strong>2 ans</strong> et sont destinées exclusivement aux membres du bureau en charge de l'organisation.
                </p>
                <p>
                  Conformément à la loi « informatique et libertés », vous pouvez exercer votre droit d'accès aux données vous concernant et les faire rectifier ou supprimer en contactant : <span className="font-semibold">unjardinpourfelix@gmail.com</span>.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        
        <Card className="border-t-4 border-t-primary shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Star className="w-8 h-8" />
            </div>
            <div>
              <CardTitle className="text-3xl font-headline font-bold text-primary">Dépôt de Candidature</CardTitle>
              <CardDescription className="text-lg">Étape 1 : Étude de votre demande par le comité</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
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
                        <FormLabel>Nom de votre Enseigne (Marque)</FormLabel>
                        <FormControl>
                          <Input placeholder="Les Artisans de Noël" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email de contact</FormLabel>
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

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="origin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Origine géographique</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Chazay, Lyon, Villefranche..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="websiteUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lien Boutique ou Réseaux (Insta, FB, Etsy...)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg">
                  <FormField
                    control={form.control}
                    name="requestedTables"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Quantité de table souhaitée</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="1" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                1 table (1m75) - 40€
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="2" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                2 tables (3m50) - 60€
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isRegistered"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Statut professionnel</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="yes" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Déclaré (RC, Micro-entrepreneur, Association)
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="no" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Particulier (L30-2 Code de Commerce)
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
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
                      <FormLabel>Nature de votre stand / Description des produits</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Détaillez vos créations, matières utilisées, univers..." 
                          className="min-h-[120px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>Les bénéfices aident Félix à progresser grâce à ses stimulations.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Consentement RGPD */}
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <FormField
                    control={form.control}
                    name="agreedToGdpr"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-bold text-primary">Consentement RGPD</FormLabel>
                          <FormDescription className="text-xs">
                            J'accepte que les informations saisies soient utilisées par l'association pour l'organisation du marché de Noël 2026. Je dispose d'un droit d'accès et de suppression en contactant l'organisateur.
                          </FormDescription>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white gold-glow h-12 text-lg font-semibold gap-2">
                  <Send className="w-5 h-5" /> Envoyer ma candidature pour étude
                </Button>
                
                <p className="text-[10px] text-center text-muted-foreground uppercase tracking-wider font-bold">
                  Bénévolat & Solidarité pour l'association "Un jardin pour Félix"
                </p>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}