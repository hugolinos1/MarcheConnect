"use client"
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { Gift, TreePine, Star, ChevronRight, Info, ShoppingBag, Calendar } from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection } from 'firebase/firestore';

export default function Home() {
  const db = useFirestore();
  const logoUrl = "https://i.ibb.co/yncRPkvR/logo-ujpf.jpg";
  
  // Market Config fetching
  const marketConfigRef = useMemoFirebase(() => collection(db, 'market_configurations'), [db]);
  const { data: configs } = useCollection(marketConfigRef);
  const currentConfig = configs?.find(c => c.currentMarket) || configs?.[0];

  const posterUrl = currentConfig?.posterImageUrl || "https://i.ibb.co/3y3KRNW4/Affiche-March.jpg";
  const marketYear = currentConfig?.marketYear || 2026;
  const editionNumber = currentConfig?.editionNumber || "6ème";
  const saturdayDate = currentConfig?.saturdayDate || "5/12/2026";
  const sundayDate = currentConfig?.sundayDate || "06/12/2026";

  return (
    <div className="min-h-screen bg-background relative">
      < ChristmasSnow />
      
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 overflow-hidden rounded-full border-2 border-primary/10">
              <Image 
                src={logoUrl}
                alt="Logo Un Jardin pour Félix"
                fill
                className="object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-headline font-bold text-lg leading-none text-primary">Le Marché de Félix</span>
              <span className="text-[10px] uppercase tracking-widest text-secondary font-bold">Un Jardin pour Félix</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/admin" className="text-sm font-medium hover:text-primary transition-colors">Portail Admin</Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-20 overflow-hidden bg-primary text-white relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/30 text-accent text-xs font-semibold uppercase tracking-wider">
                  <Star className="w-3 h-3 fill-accent" />
                  Edition Noël {marketYear}
                </div>
                <h1 className="text-5xl lg:text-7xl font-headline font-bold leading-tight">
                  Rejoignez la Magie de notre Marché Solidaire
                </h1>
                <p className="text-lg opacity-90 max-w-xl mx-auto lg:mx-0">
                  Devenez exposant pour soutenir Félix. Un événement chaleureux privilégiant l'artisanat et le fait-main à Chazay d'Azergues.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                  <Button asChild className="bg-secondary hover:bg-secondary/90 text-white gold-glow w-full sm:w-auto border-none h-16 text-xl px-12 font-bold transition-all hover:scale-105 active:scale-95">
                    <Link href="/register" className="gap-2">
                      Déposer ma candidature <ChevronRight className="w-6 h-6" />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="flex-1 relative">
                <div className="relative aspect-[3/4] max-w-[400px] mx-auto rounded-2xl overflow-hidden shadow-2xl ring-8 ring-white/10 bg-white">
                  <Image 
                    src={posterUrl}
                    alt={`Affiche Marché de Noël ${marketYear}`}
                    fill
                    className="object-contain"
                    data-ai-hint="christmas poster"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent pointer-events-none" />
                </div>
                {/* Petit badge flottant jaune */}
                <div className="absolute -bottom-6 -right-6 bg-accent p-4 rounded-xl shadow-xl flex items-center gap-3 text-accent-foreground animate-pulse z-20">
                   <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{editionNumber} Édition</p>
                    <p className="text-[11px] font-bold uppercase tracking-tighter opacity-90">
                      {saturdayDate} & {sundayDate}
                    </p>
                    <p className="text-[9px] uppercase font-bold opacity-70">Solidarité</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Selection Process Section (Timeline) */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl font-headline font-bold text-primary">Processus de sélection</h2>
              <div className="w-24 h-1 bg-accent mx-auto" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative">
              {/* Connector Line (Desktop) */}
              <div className="hidden md:block absolute top-12 left-0 right-0 h-0.5 bg-muted z-0" />
              
              {[
                {
                  step: "1",
                  title: "Préinscription",
                  desc: "Remplissez le formulaire avec vos informations de base et la nature de votre stand."
                },
                {
                  step: "2",
                  title: "Étude",
                  desc: "Le comité examine votre candidature (réponse sous 3 semaines maximum)."
                },
                {
                  step: "3",
                  title: "Validation",
                  desc: "Si accepté, vous recevez un lien unique pour compléter votre dossier administratif."
                },
                {
                  step: "4",
                  title: "Confirmation",
                  desc: "Après réception du règlement et validation du dossier, votre emplacement est réservé."
                }
              ].map((item, idx) => (
                <div key={idx} className="relative z-10 flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold shadow-xl border-4 border-white transition-transform hover:scale-110">
                    {item.step}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-foreground font-headline">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px] mx-auto">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-muted/20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl font-headline font-bold text-primary">Pourquoi nous rejoindre ?</h2>
              <div className="w-24 h-1 bg-accent mx-auto" />
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: <TreePine className="w-8 h-8 text-primary" />,
                  title: "Esprit de Noël",
                  desc: "Une ambiance féérique et familiale très appréciée des visiteurs."
                },
                {
                  icon: <Star className="w-8 h-8 text-accent" />,
                  title: "Sélection de Qualité",
                  desc: "Nous privilégions le fait-main pour garder un marché authentique."
                },
                {
                  icon: <Gift className="w-8 h-8 text-secondary" />,
                  title: "Action Solidaire",
                  desc: "Tous les bénéfices aident Félix dans ses progrès quotidiens."
                }
              ].map((f, i) => (
                <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border border-muted hover:shadow-md transition-shadow text-center space-y-4">
                  <div className="inline-flex p-3 rounded-xl bg-muted mb-2">
                    {f.icon}
                  </div>
                  <h3 className="text-xl font-headline font-semibold text-foreground">{f.title}</h3>
                  <p className="text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Association Info Section */}
        <section className="py-20">
          <div className="container mx-auto px-4 max-w-4xl">
            <Card className="border-l-4 border-l-secondary shadow-lg overflow-hidden">
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
                  L’association permet de financer des intervenants à domicile pour le stimuler et le faire progresser au quotidien.
                </p>
                <div className="pt-4 flex flex-wrap justify-center md:justify-start gap-6">
                  <Button asChild variant="link" className="text-secondary p-0 h-auto font-bold">
                    <a href="https://www.unjardinpourfelix.org/" target="_blank" className="flex items-center gap-2">
                      <Info className="w-4 h-4" /> Blog de Félix
                    </a>
                  </Button>
                  <Button asChild variant="link" className="text-primary p-0 h-auto font-bold">
                    <a href="https://www.lemarchedefelix.com/" target="_blank" className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4" /> Boutique Solidaire
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 overflow-hidden rounded-full border border-white/20">
              <Image 
                src={logoUrl}
                alt="Logo Un Jardin pour Félix"
                fill
                className="object-cover"
              />
            </div>
            <span className="font-headline font-bold text-lg">Le Marché de Félix</span>
          </div>
          <p className="text-sm opacity-80">© {marketYear} Association "Un jardin pour Félix"</p>
          <div className="flex gap-4">
            <Link href="https://www.facebook.com/lemarchedeFelix" target="_blank" className="text-sm hover:underline">Facebook</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
