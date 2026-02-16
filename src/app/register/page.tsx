
"use client"
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { TreePine, ArrowLeft, Send, Info, FileText, Heart, Star, Globe, ShieldCheck, MapPin, Loader2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { sendApplicationNotification } from '@/app/actions/email-actions';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { ScrollArea } from '@/components/ui/scroll-area';

const formSchema = z.object({
  firstName: z.string().min(2, "Le prénom est requis"),
  lastName: z.string().min(2, "Le nom est requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(10, "Numéro de téléphone requis"),
  companyName: z.string().min(2, "Nom de l'enseigne requis"),
  address: z.string().min(5, "L'adresse est requise"),
  city: z.string().min(2, "La ville est requise"),
  postalCode: z.string().regex(/^[0-9]{5}$/, "Le code postal doit contenir 5 chiffres"),
  productDescription: z.string().min(10, "Veuillez décrire vos produits (nature du stand)"),
  isRegistered: z.enum(["yes", "no"], { required_error: "Veuillez répondre à cette question" }),
  websiteUrl: z.string().optional(),
  requestedTables: z.enum(["1", "2"]),
  agreedToGdpr: z.boolean().refine(val => val === true, "L'acceptation de la politique de protection des données est requise"),
  agreedToTerms: z.boolean().refine(val => val === true, "L'acceptation du règlement est requise"),
});

export default function RegisterPage() {
  const router = useRouter();
  const db = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Market Config fetching
  const marketConfigRef = useMemoFirebase(() => collection(db, 'market_configurations'), [db]);
  const { data: configs } = useCollection(marketConfigRef);
  const currentConfig = configs?.find(c => c.currentMarket) || configs?.[0];
  const marketYear = currentConfig?.marketYear || 2026;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      companyName: "",
      address: "",
      city: "",
      postalCode: "",
      productDescription: "",
      isRegistered: "yes",
      websiteUrl: "",
      requestedTables: "1",
      agreedToGdpr: false,
      agreedToTerms: false,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    
    try {
      const newExhibitor = {
        ...values,
        isRegistered: values.isRegistered === "yes",
        status: 'pending',
        marketConfigurationId: currentConfig?.id || 'default',
        createdAt: new Date().toISOString(),
      };
      
      const colRef = collection(db, 'pre_registrations');
      await addDocumentNonBlocking(colRef, newExhibitor);
      
      await sendApplicationNotification(newExhibitor, currentConfig);
      
      router.push('/register/success');
    } catch (error) {
      console.error("Erreur lors de la soumission :", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 relative overflow-hidden text-foreground">
      <ChristmasSnow />
      <div className="container mx-auto max-w-4xl relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-8 font-medium">
          <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
        </Link>
        
        <div className="grid gap-4 mb-8">
          <Accordion type="single" collapsible className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <AccordionItem value="reglement" className="border-none">
              <AccordionTrigger className="px-6 hover:no-underline hover:bg-muted/50 text-left">
                <span className="flex items-center gap-2 font-bold text-primary">
                  <FileText className="w-5 h-5" /> Règlement du Marché {marketYear}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <ScrollArea className="h-96 pr-4 text-xs text-muted-foreground space-y-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 1 : Dates & Lieu</h4>
                      <p>Le marché aura lieu le samedi 05/12/{marketYear} de 14h à 19h et le dimanche 06/12/{marketYear} de 10h à 17h30 à la salle Maurice Baquet, rue Pierre Coubertin (à droite de l’entrée du stade de foot) à Chazay d’Azergues (69380).</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 2 : Inscription</h4>
                      <p>L’inscription n’est possible que sur les 2 jours. Pas de dérogation possible.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 3 : Sélection & Candidature</h4>
                      <p>Nous répondrons à toutes les candidatures, par mail (que la réponse soit positive ou négative) dans les 15 semaines suivant votre demande. Nous nous octroyons le droit de refuser une candidature si les articles proposés ne conviennent pas à notre sélection : Hors thématique Noël /idée cadeau Noël ou si plusieurs exposants proposent des articles similaires. Nous privilégions les articles et produits artisanaux. Nous n’acceptons pas la revente. Les attributions et les emplacements ne sont pas systématiquement renouvelés d’une année sur l’autre, ceci afin de garder notre marché attrayant.</p>
                      <p className="mt-2">Vous vous engagez à ne mettre sur votre stand que les articles qui ont été validés par le bureau du marché de Noël. Si besoin, nous vous demanderons de retirer les articles inadéquats. Dans la mesure du possible, merci de porter un soin à votre stand : nappes pour recouvrir la table, mettre en avant le nom de votre marque, rendre lisible ce que vous vendez.</p>
                      <p className="mt-2">Nous serons sensibles aux demandes de personnes étant déclarées au registre du commerce. Le régime de micro-entreprise (régime micro-Bic) calcule les taxes qu’au strict pourcentage des ventes, cela n’engage donc pas de frais supplémentaires pour vous. Dans le cas où vous n’êtes pas déclaré, l’article L30-2 du code de commerce autorise les particuliers non inscrits à participer 2 fois/an à des marchés.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 4 : Installation & Logistique</h4>
                      <p>L’installation des exposants (artisans/créateurs exclusivement) aura lieu le samedi entre 11h et 13h. Les emplacements seront attribués à l’arrivée de chaque exposant. Grilles, tables et chaises sont fournies et installées préalablement, en fonction des besoins exprimés.</p>
                      <p className="mt-2">Nous pourrons fournir en électricité 8 à 10 stands maximum, merci d’en faire la demande lors de l’inscription. Nous ne garantirons pas de pouvoir répondre à toutes les demandes, priorité sera donnée aux produits alimentaires. Les rallonges sont à prévoir par l'exposant.</p>
                      <p className="mt-2">Nous vous préviendrons début novembre de l’attribution du point électrique. Le jour du marché, nous vous indiquerons l’emplacement avec l’électricité pour un supplément de 1€.</p>
                      <p className="mt-2">Il est essentiel de respecter les horaires d’installation pour ne pas retarder l’ouverture du marché de Noël. Si vous pensez avoir du retard ou avez un empêchement de dernière minute, merci de prévenir Cécile Rabier au 06 81 14 77 76. Le démontage du stand ne pourra se faire que le dimanche après la fermeture du marché soit 17h30.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 5 : Tarifs & Restauration</h4>
                      <p>- Un chèque correspondant au nombre de tables souhaité (1 table = 1m75 ou 2 tables = 3m50) est demandé après validation de votre inscription. Sans ce versement, l’inscription ne sera pas prise en compte. Tarif {marketYear} : 40€ pour 1 table et 60€ pour 2 tables (mesures table : 1m75x0.8m).</p>
                      <p>- Chèque à l’ordre de « Les amis d’un jardin pour Félix » association locale de Chazay d’Azergues. Le chèque sera encaissé à partir du 20 novembre {marketYear}. Toute annulation à partir de cette date ne donnera pas lieu à remboursement.</p>
                      <p>- Restauration : nous proposons aux exposants un plateau repas le dimanche midi (8€). Réservation et paiement demandés en même temps que l’inscription. Plateau fait maison : salade, quiche, fromage, dessert, eau.</p>
                      <p>- Le dimanche matin à 9h30 : moment convivial offert (café, thé, gâteaux) pour débriefer de la veille.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 6 : Action Solidaire & Tombola</h4>
                      <p>Nous organisons cette année une tombola solidaire. Nous vous sollicitons pour offrir un lot (sans obligation) mettant en avant votre savoir-faire. N’hésitez pas à joindre votre carte de visite. Les lots seront récupérés le samedi matin à votre arrivée.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 7 : Droits à l'image</h4>
                      <p>L’exposant accepte que des vues de son stand puissent être prises par l’organisateur ou la Mairie de Chazay d’Azergues et en accepte la diffusion gratuite dans le cadre de la communication liée à la manifestation.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 8 : Responsabilité & Assurance</h4>
                      <p>Les organisateurs ne sont pas responsables des vols ou dégradations. L’exposant est tenu de souscrire, à ses frais, toutes assurances couvrant les risques que lui-même, son matériel ou ses accompagnateurs encourent ou font courir à des tiers.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 9 : Obligations</h4>
                      <p>L’exposant s’engage à être conforme à la législation en vigueur et assume l’entière responsabilité de ses ventes et de ses déclarations fiscales.</p>
                    </div>
                  </div>
                </ScrollArea>
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
              <CardDescription className="text-lg">Étape 1 : Étude de votre demande par le comité {marketYear}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom</FormLabel>
                        <FormControl>
                          <Input placeholder="Dupont" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom</FormLabel>
                        <FormControl>
                          <Input placeholder="Jean" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" /> Adresse (N°, rue)
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="12 rue de la Paix" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ville</FormLabel>
                        <FormControl>
                          <Input placeholder="Chazay d'Azergues" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code Postal</FormLabel>
                        <FormControl>
                          <Input placeholder="69380" maxLength={5} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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

                <div className="space-y-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
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
                            J'accepte que les informations saisies soient utilisées par l'association pour l'organisation du marché de Noël {marketYear}. Je dispose d'un droit d'accès et de suppression en contactant l'organisateur.
                          </FormDescription>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="agreedToTerms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 border-t pt-4">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-bold text-primary">Règlement du Marché</FormLabel>
                          <FormDescription className="text-xs">
                            J'ai lu et j'accepte l'intégralité du règlement du Marché de Noël {marketYear} (consultable en haut de cette page).
                          </FormDescription>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-primary hover:bg-primary/90 text-white gold-glow h-12 text-lg font-semibold gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" /> Envoyer ma candidature pour étude
                    </>
                  )}
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
