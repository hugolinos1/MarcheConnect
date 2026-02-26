
"use client"
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { TreePine, ArrowLeft, Send, FileText, Star, Camera, X, MapPin, Loader2, ShieldCheck } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { sendApplicationNotification } from '@/app/actions/email-actions';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
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
  
  const marketConfigQuery = useMemoFirebase(() => query(collection(db, 'market_configurations'), orderBy('marketYear', 'desc')), [db]);
  const { data: configs } = useCollection(marketConfigQuery);
  const currentConfig = configs?.find(c => c.currentMarket) || configs?.[0];
  const marketYear = currentConfig?.marketYear || 2026;

  const satDate = currentConfig?.saturdayDate || "5/12/2026";
  const satHours = currentConfig?.saturdayHours || "14h à 19h";
  const sunDate = currentConfig?.sundayDate || "06/12/2026";
  const sunHours = currentConfig?.sundayHours || "10h à 17h30";

  const priceTable1 = currentConfig?.priceTable1 ?? 40;
  const priceTable2 = currentConfig?.priceTable2 ?? 60;

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
    
    let finalWebsiteUrl = values.websiteUrl?.trim() || "";
    if (finalWebsiteUrl && !finalWebsiteUrl.startsWith('http')) {
      finalWebsiteUrl = `https://${finalWebsiteUrl}`;
    }
    
    try {
      const newExhibitor = {
        ...values,
        websiteUrl: finalWebsiteUrl,
        companyName: values.companyName || `${values.firstName} ${values.lastName}`,
        isRegistered: values.isRegistered === "yes",
        status: 'pending',
        marketConfigurationId: currentConfig?.id || 'default',
        createdAt: new Date().toISOString(),
        productImages: images,
      };
      
      const colRef = collection(db, 'pre_registrations');
      await addDocumentNonBlocking(colRef, newExhibitor);
      
      // On passe currentConfig qui contient maintenant smtpUser et smtpPass si configurés
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
          <Accordion type="multiple" className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <AccordionItem value="reglement" className="border-b">
              <AccordionTrigger className="px-6 hover:no-underline hover:bg-muted/50 text-left">
                <span className="flex items-center gap-2 font-bold text-primary">
                  <FileText className="w-5 h-5" /> Règlement du Marché {marketYear}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <ScrollArea className="h-96 pr-4 text-xs text-muted-foreground">
                  <div className="space-y-6 pb-12 leading-relaxed">
                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 1 :</h4>
                      <p>Le marché aura lieu le samedi {satDate} de {satHours} et le dimanche {sunDate} de {sunHours} à la salle Maurice Baquet, rue Pierre Coubertin à Chazay d’Azergues (69380).</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 2 :</h4>
                      <p>L’inscription n’est possible que sur les 2 jours. Pas de dérogation possible.</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 3 :</h4>
                      <p>Nous privilégions les articles et produits artisanaux. Nous n’acceptons pas la revente.</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 4 :</h4>
                      <p>L’installation des exposants aura lieu le samedi entre 11h et 13h.</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 5 :</h4>
                      <p>- {priceTable1}€ pour 1 table (1.75m)</p>
                      <p>- {priceTable2}€ pour 2 tables (3.50m)</p>
                    </div>
                  </div>
                </ScrollArea>
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
                        <FormControl><Input placeholder="Dupont" {...field} /></FormControl>
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
                        <FormControl><Input placeholder="Jean" {...field} /></FormControl>
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
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl><RadioGroupItem value="yes" /></FormControl>
                              <FormLabel className="font-normal">Déclaré (RC, Micro-entrepreneur, Association)</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl><RadioGroupItem value="no" /></FormControl>
                              <FormLabel className="font-normal">Particulier (L30-2 Code de Commerce)</FormLabel>
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
                      <FormLabel>Nom de votre Enseigne / Marque {watchIsRegistered === 'no' && "(Optionnel)"}</FormLabel>
                      <FormControl><Input placeholder={watchIsRegistered === 'no' ? "Laissez vide si pas d'enseigne" : "Les Artisans de Noël"} {...field} /></FormControl>
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
                        <FormControl><Input type="email" placeholder="contact@votre-boutique.fr" {...field} /></FormControl>
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
                        <FormControl><Input placeholder="06 01 02 03 04" {...field} /></FormControl>
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
                      <FormLabel className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Adresse</FormLabel>
                      <FormControl><Input placeholder="12 rue de la Paix" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem><FormLabel>Ville</FormLabel><FormControl><Input placeholder="Chazay d'Azergues" {...field} /></FormControl><FormMessage /></FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem><FormLabel>Code Postal</FormLabel><FormControl><Input placeholder="69380" maxLength={5} {...field} /></FormControl><FormMessage /></FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="websiteUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lien Boutique ou Réseaux (Insta, FB, Etsy...)</FormLabel>
                      <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4 p-6 bg-muted/20 rounded-xl border-2 border-dashed border-primary/20">
                  <div className="flex items-center gap-3 text-primary mb-2">
                    <Camera className="w-6 h-6" />
                    <h3 className="text-lg font-bold">Photos de vos produits</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border shadow-sm group">
                        <Image src={img} alt={`Produit ${idx + 1}`} fill className="object-cover" />
                        <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-destructive text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                    {images.length < 3 && (
                      <label className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 bg-white hover:bg-muted/50 cursor-pointer">
                        {isProcessingImage ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-8 h-8 text-muted-foreground" />}
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isProcessingImage} />
                      </label>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Merci de fournir 3 photos illustrant vos créations.</p>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <FormField
                    control={form.control}
                    name="requestedTables"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Quantité de table souhaitée</FormLabel>
                        <FormControl>
                          <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="1" /></FormControl><FormLabel className="font-normal">1 table (1m75) - {priceTable1}€</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="2" /></FormControl><FormLabel className="font-normal">2 tables (3m50) - {priceTable2}€</FormLabel></FormItem>
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
                      <FormControl><Textarea placeholder="Détaillez vos créations..." className="min-h-[120px]" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-6 pt-6">
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 space-y-4 shadow-inner">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
                      <ShieldCheck className="w-4 h-4" /> Consentements
                    </h3>
                    
                    <div className="space-y-4">
                      <FormField control={form.control} name="agreedToGdpr" render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="font-bold text-primary text-xs">Protection des données (RGPD) *</FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )} />
                      
                      <FormField control={form.control} name="agreedToTerms" render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 border-t border-primary/10 pt-4">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="font-bold text-primary text-xs">Règlement du Marché *</FormLabel>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )} />
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90 text-white gold-glow h-16 text-xl font-bold gap-2 mt-8">
                  {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />} Envoyer ma candidature
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
