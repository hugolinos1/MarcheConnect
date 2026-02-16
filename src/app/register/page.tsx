
"use client"
import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { TreePine, ArrowLeft, Send, Info, FileText, Heart, Star, Globe, ShieldCheck, MapPin, Loader2, Camera, X } from 'lucide-react';
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
import Image from 'next/image';

const formSchema = z.object({
  firstName: z.string().min(2, "Le prénom est requis"),
  lastName: z.string().min(2, "Le nom est requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(10, "Numéro de téléphone requis"),
  companyName: z.string().optional(),
  address: z.string().min(5, "L'adresse est requise"),
  city: z.string().min(2, "La ville est requise"),
  postalCode: z.string().regex(/^[0-9]{5}$/, "Le code postal doit contenir 5 chiffres"),
  productDescription: z.string().min(10, "Veuillez décrire vos produits (nature du stand)"),
  isRegistered: z.enum(["yes", "no"], { required_error: "Veuillez répondre à cette question" }),
  websiteUrl: z.string().optional(),
  requestedTables: z.enum(["1", "2"]),
  agreedToGdpr: z.boolean().refine(val => val === true, "L'acceptation de la politique de protection des données est requise"),
  agreedToTerms: z.boolean().refine(val => val === true, "L'acceptation du règlement est requise"),
}).refine((data) => {
  if (data.isRegistered === "yes" && (!data.companyName || data.companyName.trim().length < 2)) {
    return false;
  }
  return true;
}, {
  message: "Le nom de l'enseigne est requis pour les professionnels",
  path: ["companyName"],
});

export default function RegisterPage() {
  const router = useRouter();
  const db = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  
  // Market Config fetching
  const marketConfigRef = useMemoFirebase(() => collection(db, 'market_configurations'), [db]);
  const { data: configs } = useCollection(marketConfigRef);
  const currentConfig = configs?.find(c => c.currentMarket) || configs?.[0];
  const marketYear = currentConfig?.marketYear || 2026;

  // Prices from config
  const priceTable1 = currentConfig?.priceTable1 ?? 40;
  const priceTable2 = currentConfig?.priceTable2 ?? 60;
  const priceMeal = currentConfig?.priceMeal ?? 8;
  const priceElectricity = currentConfig?.priceElectricity ?? 1;

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (images.length >= 3) return;

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
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
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
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          };
        };
      });
    };

    try {
      const compressed = await compressImage(file);
      setImages(prev => [...prev, compressed]);
    } catch (err) {
      console.error("Compression error:", err);
    } finally {
      setIsProcessingImage(false);
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (images.length === 0) {
      alert("Merci de fournir au moins une photo de vos produits.");
      return;
    }
    setIsSubmitting(true);
    
    try {
      const newExhibitor = {
        ...values,
        companyName: values.companyName || `${values.firstName} ${values.lastName}`,
        isRegistered: values.isRegistered === "yes",
        status: 'pending',
        marketConfigurationId: currentConfig?.id || 'default',
        createdAt: new Date().toISOString(),
        productImages: images,
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

  const watchIsRegistered = form.watch("isRegistered");

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
                <ScrollArea className="h-96 pr-4 text-xs text-muted-foreground">
                  <div className="space-y-4 pb-12">
                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 1 :</h4>
                      <p>Le marché aura lieu le samedi 05/12/{marketYear} de 14h à 19h et le dimanche 06/12/{marketYear} de 10h à 17h30 à la salle Maurice Baquet, rue Pierre Coubertin (à droite de l’entrée du stade de foot) à Chazay d’Azergues (69380).</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 2 :</h4>
                      <p>L’inscription n’est possible que sur les 2 jours. Pas de dérogation possible.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 3 :</h4>
                      <p>Nous répondrons à toutes les candidatures, par mail (que la réponse soit positive ou négative) dans les 15 semaines suivant votre demande. Nous nous octroyons le droit de refuser une candidature si les articles proposés ne conviennent pas à notre sélection : Hors thématique Noël /idée cadeau Noël ou si plusieurs exposants proposent des articles similaires. Nous privilégions les articles et produits artisanaux. Nous n’acceptons pas la revente. Les attributions et les emplacements ne sont pas systématiquement renouvelés d’une année sur l’autre, ceci afin de garder notre marché attrayant.</p>
                      <p className="mt-2">Vous vous engagez à ne mettre sur votre stand que les articles qui ont été validés par le bureau du marché de Noël. Si besoin, nous vous demanderons de retirer les articles inadéquats.</p>
                      <p className="mt-2">Dans la mesure du possible, merci de porter un soin à votre stand : nappes pour recouvrir la table, mettre en avant le nom de votre marque, rendre lisible ce que vous vendez.</p>
                      <p className="mt-2">Nous serons sensibles aux demandes de personnes étant déclarées au registre du commerce. Le régime de micro-entreprise (régime micro-Bic) calcule les taxes qu’au strict pourcentage des ventes, cela n’engage donc pas de frais supplémentaires pour vous. Dans le cas où vous n’êtes pas déclaré, l’article L30-2 du code de commerce autorise les particuliers non inscrits à participer 2 fois/an à des marchés.</p>
                      <p className="mt-2 font-bold text-primary">Pour toute demande : envoi de photos récentes présentant vos créations. Lien de votre site marchand (facebook, etsy, instagram, internet…)</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 4 :</h4>
                      <p>L’installation des exposants (artisans/créateurs exclusivement) aura lieu le samedi entre 11h et 13h. Les emplacements seront attribués à l’arrivée de chaque exposant. Grilles, tables et chaises sont fournies et installées préalablement, en fonction des besoins exprimés.</p>
                      <p className="mt-2">Nous pourrons fournir en électricité 8 à 10 stands maximum, merci d’en faire la demande lors de l’inscription. Nous ne garantirons pas de pouvoir répondre à toutes les demandes, priorité sera donnée aux produits alimentaires. Les rallonges sont à prévoir par l'exposant.</p>
                      <p className="mt-2">Nous vous préviendrons début novembre de l’attribution du point électrique. Le jour du marché, nous vous indiquerons l’emplacement avec l’électricité pour un supplément de {priceElectricity}€. </p>
                      <p className="mt-2">Il est essentiel de respecter les horaires d’installation pour ne pas retarder l’ouverture du marché de Noël. Si vous pensez avoir du retard ou avez un empêchement de dernière minute à la suite d’une contrainte familiale ou médicale, merci de me prévenir au 06 81 14 77 76 (Cécile Rabier).</p>
                      <p className="mt-2">Merci de prendre en compte le temps d’installation de votre stand pour qu’il soit prêt à l’ouverture au public. Le démontage du stand ne pourra se faire que le dimanche après la fermeture du marché soit 17h30.</p>
                      <p className="mt-2">Nous ne prévoyons pas de bénévoles pour vous aider à ranger, nos bénévoles sont là pour l’organisation du marché en priorité.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 5 :</h4>
                      <p>- Un chèque correspondant au nombre de tables souhaité (1 table = 1m75 ou 2 tables = 3m50) est demandé après validation de votre inscription. Sans ce versement, l’inscription ne sera pas prise en compte. Tarif {marketYear} : {priceTable1}€ pour 1 table et {priceTable2}€ pour 2 tables (les tables sont fournies / mesures de la table : 1m75x0.8m).</p>
                      <p>- Chèque à l’ordre de « Les amis d’un jardin pour Félix » association locale de Chazay d’Azergues. Le chèque sera encaissé à partir du 20 novembre {marketYear}.</p>
                      <p>- Toute annulation à partir du 20 novembre ne donnera pas lieu à remboursement.</p>
                      <p>- Restauration : nous proposons aux exposants un plateau repas le dimanche midi. Si vous êtes intéressés, la réservation (+ paiement) est demandée en même temps que l’inscription. Il s’agit d’un plateau repas fait maison : salade composée maison, part de quiche (différentes recettes), fromage avec une tranche de pain, une clémentine et une part de gâteau à choisir au bar et une bouteille d’eau. Le prix du repas/personne est de {priceMeal}€, toujours le même tarif depuis 2023.</p>
                      <p>- Un café, un thé ou une boisson fraîche vous sera offert le samedi contre remise d’un ticket qui vous sera attribué à votre arrivée (nous n’offrons pas de chocolat chaud, ni de vin chaud, ni tout autre boisson autre que celles énoncées ci-dessus).</p>
                      <p>- Le dimanche matin nous vous invitons à venir pour 9h30 afin de vous offrir café, thé ou une bouteille d’eau accompagné d’une part de gâteau (offert par Bruno Saladino, chocolatier à Vilefranche sur saône). Ce moment nous permet de débriefer de la veille.</p>
                      <p>- Une buvette avec petite restauration à tarif attractif sera ouverte à tous le samedi midi et le dimanche (salades, quiches, crêpes, crêpes salées, gâteaux …)</p>
                      <p>- Pour des raisons de sécurité, les appareils de chauffage et de cuisson sont strictement interdits sur les stands.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 6 :</h4>
                      <p>Nous organisons cette année une tombola avec une vente de ticket à 2€, que nous proposerons en amont de l’évènement lors de la foulée des jeunes, la course des 9 clochers le 10 et 11 octobre à Chazay. Nous allons démarcher des acteurs locaux afin de récolter des lots qui mettent en avant la gastronomie, les animations locales, le savoir-faire artisanal du département et de la région.</p>
                      <p className="mt-2">Nous vous sollicitons également pour faire un lot, à cet effet vous pourrez cocher la case en fin de bulletin et peut-être préciser la nature de votre don. Il n’y a pas d’obligation, c’est au bon vouloir de chacun. N’hésitez pas à mettre votre carte de visite afin de faire connaître votre marque à l’heureux gagnant.</p>
                      <p className="mt-2">Pour un souci d’organisation, nous aimerions pouvoir récupérer votre lot dès votre arrivée le samedi matin.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground underline mb-1 text-uppercase">Article 7 : DROITS A L’IMAGE</h4>
                      <p>L’exposant accepte que des vues de son stand puissent être prises par l’organisateur ou la Mairie de Chazay d’Azergues et en accepte la diffusion gratuite dans le cadre de toute communication liée à la manifestation (facebook, instagram, site marchand de l’association).</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground underline mb-1 text-uppercase">Article 8 : RESPONSABILITE – ASSURANCE</h4>
                      <p>Les organisateurs ne sont pas dépositaires des œuvres au sens donné à ce terme par le code civil, mais seulement détenteurs précaires des œuvres/marchandises exposées. Ils ne pourront donc en aucun cas encourir de responsabilité en cas de vol ou dégradations en tout genre et circonstance.</p>
                      <p className="mt-2">Outre l’assurance couvrant les objets exposés et plus généralement tous les éléments lui appartenant, l’exposant est tenu de souscrire, à ses frais, toutes assurances couvrant les risques que lui-même, les personnes qui l’accompagnent et son matériel encourent ou font courir à des tiers. L’organisateur est dégagé de toute responsabilité à cet égard, notamment en cas d’accident, de perte, vol, incendie, dégât naturel, ou dommage quelconque. L’organisateur se réserve le droit d’annuler la manifestation en cas de force majeure.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-foreground underline mb-1 text-uppercase">Article 9 : OBLIGATIONS DE L’EXPOSANT</h4>
                      <p>L’exposant s’engage à être conforme à la législation en vigueur et assume l’entière responsabilité de ses ventes. L’organisateur décline toute responsabilité relative aux déclarations légales vis-à-vis de l’Administration fiscale.</p>
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

                <div className="grid md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg">
                  <FormField
                    control={form.control}
                    name="isRegistered"
                    render={({ field }) => (
                      <FormItem className="space-y-3 col-span-2">
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
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Nom de votre Enseigne / Marque {watchIsRegistered === 'no' && "(Optionnel)"}
                      </FormLabel>
                      <FormControl>
                        <Input placeholder={watchIsRegistered === 'no' ? "Laissez vide si pas d'enseigne" : "Les Artisans de Noël"} {...field} />
                      </FormControl>
                      <FormDescription>
                        {watchIsRegistered === 'no' ? "Si vide, nous utiliserons vos Nom et Prénom." : "Obligatoire pour les professionnels."}
                      </FormDescription>
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

                <div className="space-y-4 p-6 bg-muted/20 rounded-xl border-2 border-dashed border-primary/20">
                  <div className="flex items-center gap-3 text-primary mb-2">
                    <Camera className="w-6 h-6" />
                    <h3 className="text-lg font-bold">Photos de vos produits</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Veuillez fournir <strong>3 photos</strong> qui illustrent les produits que vous proposez pour notre sélection.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border shadow-sm group">
                        <Image src={img} alt={`Produit ${idx + 1}`} fill className="object-cover" />
                        <button 
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 bg-destructive text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {images.length < 3 && (
                      <label className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 bg-white hover:bg-muted/50 cursor-pointer transition-colors">
                        {isProcessingImage ? (
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Ajouter photo</span>
                            <span className="text-[10px] text-muted-foreground/60 mt-1">({images.length}/3)</span>
                          </>
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleImageUpload} 
                          disabled={isProcessingImage}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-1 gap-6 p-4 bg-muted/30 rounded-lg">
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
                                1 table (1m75) - {priceTable1}€
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="2" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                2 tables (3m50) - {priceTable2}€
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
