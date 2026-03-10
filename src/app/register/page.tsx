
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
import { TreePine, ArrowLeft, Send, FileText, Star, Camera, X, MapPin, Loader2, ShieldCheck, Info, Lock } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { sendApplicationNotification } from '@/app/actions/email-actions';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, addDoc, doc, setDoc } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';

const CHUNK_SIZE = 800000;

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
  const { toast } = useToast();
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

    const file = files[0];
    if (file.size > 3 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Fichier trop lourd",
        description: "Chaque fichier doit faire moins de 3 Mo."
      });
      e.target.value = '';
      return;
    }

    setIsProcessingImage(true);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setImages(prev => [...prev, ev.target?.result as string]);
      setIsProcessingImage(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (images.length === 0) {
      toast({ variant: "destructive", title: "Photos manquantes", description: "Merci de fournir au moins une photo." });
      return;
    }
    setIsSubmitting(true);
    
    let finalWebsiteUrl = values.websiteUrl?.trim() || "";
    if (finalWebsiteUrl && !finalWebsiteUrl.startsWith('http')) {
      finalWebsiteUrl = `https://${finalWebsiteUrl}`;
    }
    
    try {
      // Nettoyage des images pour le doc principal (on stocke des placeholders si trop gros)
      const sanitizedImages = images.map(img => img.length > CHUNK_SIZE ? "CHUNKED_IMAGE" : img);

      const newExhibitor = {
        ...values,
        websiteUrl: finalWebsiteUrl,
        companyName: values.companyName || `${values.firstName} ${values.lastName}`,
        isRegistered: values.isRegistered === "yes",
        status: 'pending',
        marketConfigurationId: currentConfig?.id || 'default',
        createdAt: new Date().toISOString(),
        productImages: sanitizedImages,
      };
      
      const docRef = await addDoc(collection(db, 'pre_registrations'), newExhibitor);
      
      // Enregistrement des morceaux pour chaque image trop grosse
      for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
        const fullImg = images[imgIdx];
        if (fullImg.length > CHUNK_SIZE) {
          const totalChunks = Math.ceil(fullImg.length / CHUNK_SIZE);
          for (let i = 0; i < totalChunks; i++) {
            const chunk = fullImg.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            await setDoc(doc(db, 'pre_registrations', docRef.id, 'chunks', `img_${imgIdx}_${i}`), {
              data: chunk,
              imgIndex: imgIdx,
              chunkIndex: i
            });
          }
        }
      }
      
      await sendApplicationNotification(newExhibitor, currentConfig);
      router.push('/register/success');
    } catch (error) {
      console.error("Erreur lors de la soumission :", error);
      toast({ 
        variant: "destructive", 
        title: "Échec de l'envoi", 
        description: "Votre candidature n'a pas pu être envoyée. Essayez de réduire la taille des fichiers." 
      });
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
                <ScrollArea className="h-[500px] pr-4 text-xs text-muted-foreground">
                  <div className="space-y-6 pb-12 leading-relaxed">
                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 1</h4>
                      <p>Le marché aura lieu le samedi {satDate} de {satHours} et le dimanche {sunDate} de {sunHours} à la salle Maurice Baquet, rue Pierre Coubertin à Chazay d’Azergues (69380).</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 2</h4>
                      <p>L’inscription n’est possible que sur les 2 jours.</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 3</h4>
                      <p>Nous répondrons à toutes les candidatures dans les 3 semaines. Nous privilégions l’artisanat.</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 4</h4>
                      <p>L’installation a lieu le samedi entre 11h et 13h. Électricité disponible pour un supplément de {priceElectricity}€.</p>
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground underline mb-1">Article 5</h4>
                      <p>Tarifs : {priceTable1}€ (1 table) / {priceTable2}€ (2 tables). Repas dimanche : {priceMeal}€.</p>
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
                  <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem><FormLabel>Nom</FormLabel><FormControl><Input placeholder="Dupont" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem><FormLabel>Prénom</FormLabel><FormControl><Input placeholder="Jean" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <div className="grid md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg">
                  <FormField control={form.control} name="isRegistered" render={({ field }) => (
                    <FormItem className="space-y-3 col-span-2">
                      <FormLabel>Statut professionnel</FormLabel>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                          <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="yes" /></FormControl><FormLabel className="font-normal">Déclaré (RC, Micro-entrepreneur, Association)</FormLabel></FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="no" /></FormControl><FormLabel className="font-normal">Particulier (L30-2 Code de Commerce)</FormLabel></FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="companyName" render={({ field }) => (
                  <FormItem><FormLabel>Enseigne / Marque {watchIsRegistered === 'no' && "(Optionnel)"}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Téléphone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel><MapPin className="w-4 h-4 text-primary" /> Adresse</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem><FormLabel>Ville</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="postalCode" render={({ field }) => (
                    <FormItem><FormLabel>Code Postal</FormLabel><FormControl><Input maxLength={5} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="websiteUrl" render={({ field }) => (
                  <FormItem><FormLabel>Lien Boutique / Réseaux</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <div className="space-y-4 p-6 bg-muted/20 rounded-xl border-2 border-dashed border-primary/20">
                  <h3 className="text-lg font-bold flex items-center gap-3 text-primary"><Camera className="w-6 h-6" /> Photos de vos produits (Max 3 Mo / fichier)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border shadow-sm group">
                        {img.startsWith('data:application/pdf') ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-primary/5 text-primary">
                            <FileText className="w-10 h-10 mb-1" /><span className="text-[10px] font-bold">PDF</span>
                          </div>
                        ) : (
                          <Image src={img} alt="Produit" fill className="object-cover" />
                        )}
                        <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-destructive text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                    {images.length < 3 && (
                      <label className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 bg-white hover:bg-muted/50 cursor-pointer text-center p-2">
                        {isProcessingImage ? <Loader2 className="animate-spin" /> : <Camera className="w-8 h-8 text-muted-foreground" />}
                        <span className="text-[10px] mt-2">Ajouter photo ou PDF</span>
                        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleImageUpload} disabled={isProcessingImage} />
                      </label>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg">
                  <FormField control={form.control} name="requestedTables" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantité de table</FormLabel>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value}>
                          <FormItem className="flex items-center space-x-3"><FormControl><RadioGroupItem value="1" /></FormControl><FormLabel className="font-normal">1 table ({priceTable1}€)</FormLabel></FormItem>
                          <FormItem className="flex items-center space-x-3"><FormControl><RadioGroupItem value="2" /></FormControl><FormLabel className="font-normal">2 tables ({priceTable2}€)</FormLabel></FormItem>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="productDescription" render={({ field }) => (
                  <FormItem><FormLabel>Description des produits</FormLabel><FormControl><Textarea className="min-h-[120px]" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <div className="space-y-4 p-6 bg-primary/5 border border-primary/20 rounded-2xl">
                  <h3 className="text-sm font-bold text-primary flex items-center gap-2 uppercase"><ShieldCheck className="w-4 h-4" /> Consentements</h3>
                  <FormField control={form.control} name="agreedToGdpr" render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-xs">J'accepte la politique de confidentialité (RGPD) *</FormLabel></FormItem>
                  )} />
                  <FormField control={form.control} name="agreedToTerms" render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-xs">J'accepte le règlement du Marché *</FormLabel></FormItem>
                  )} />
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full bg-primary h-16 text-xl font-bold gap-2">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <Send />} Envoyer ma candidature
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
