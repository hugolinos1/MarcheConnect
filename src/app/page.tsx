
"use client"
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { Gift, TreePine, Star, ChevronRight, Info, ShoppingBag, Calendar, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection } from 'firebase/firestore';

export default function Home() {
  const db = useFirestore();
  const logoUrl = "https://i.ibb.co/yncRPkvR/logo-ujpf.jpg";
  
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
      <ChristmasSnow />
      
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 shrink-0 overflow-hidden rounded-full border-2 border-primary/10">
              <Image src={logoUrl} alt="Logo" fill className="object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="font-headline font-bold text-lg leading-none text-primary">Le Marché de Félix</span>
              <span className="text-[10px] uppercase tracking-widest text-secondary font-bold">UN JARDIN POUR FÉLIX</span>
            </div>
          </div>
          <nav>
            <Link href="/admin" className="text-sm font-bold flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-colors">
              <ShieldCheck className="w-4 h-4" />
              <span>Portail Admin</span>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="py-20 bg-primary text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/20 border border-accent/30 text-accent text-xs font-semibold uppercase">
                  <Star className="w-3 h-3 fill-accent" />
                  Edition Noël {marketYear}
                </div>
                <h1 className="text-5xl lg:text-7xl font-headline font-bold leading-tight">Rejoignez la Magie de notre Marché Solidaire</h1>
                <p className="text-lg opacity-90 max-w-xl">Devenez exposant pour soutenir Félix. Un événement chaleureux privilégiant l'artisanat à Chazay d'Azergues.</p>
                <Button asChild className="bg-secondary hover:bg-secondary/90 text-white gold-glow h-16 px-12 text-xl font-bold rounded-xl transition-all hover:scale-105">
                  <Link href="/register">Déposer ma candidature <ChevronRight className="w-6 h-6 ml-2" /></Link>
                </Button>
              </div>
              <div className="flex-1 relative">
                <div className="relative aspect-[3/4] max-w-[400px] mx-auto rounded-2xl overflow-hidden shadow-2xl ring-8 ring-white/10 bg-white">
                  <Image src={posterUrl} alt="Affiche" fill className="object-contain" />
                </div>
                <div className="absolute -bottom-6 -right-6 bg-accent p-4 rounded-xl shadow-xl flex items-center gap-3 text-accent-foreground z-20 animate-pulse">
                   <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center"><Calendar className="w-5 h-5" /></div>
                   <div>
                    <p className="font-bold text-sm">{editionNumber} Édition</p>
                    <p className="text-[11px] font-bold uppercase tracking-tighter">{saturdayDate} & {sundayDate}</p>
                    <p className="text-[9px] uppercase font-bold opacity-70">SOLIDARITÉ</p>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Processus de sélection */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-headline font-bold text-primary mb-16">Processus de sélection</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
              {[
                { s: "1", t: "Préinscription", d: "Remplissez le formulaire initial (Etape 1)." },
                { s: "2", t: "Étude", d: "Le comité examine votre candidature sous 3 semaines." },
                { s: "3", t: "Validation", d: "Si accepté, vous recevez un lien vers votre dossier technique." },
                { s: "4", t: "Confirmation", d: "Votre emplacement est réservé dès réception du règlement." }
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold shadow-lg">{item.s}</div>
                  <h3 className="font-bold text-lg">{item.t}</h3>
                  <p className="text-sm text-muted-foreground">{item.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Association Presentation Block - Placé sous le processus */}
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <Card className="max-w-3xl mx-auto border-l-4 border-l-secondary shadow-xl overflow-hidden">
              <div className="p-8 flex flex-col md:flex-row items-center gap-8 bg-white">
                <div className="relative w-32 h-32 shrink-0 rounded-full overflow-hidden border-4 border-primary/5">
                  <Image src={logoUrl} alt="Logo Association" fill className="object-cover" />
                </div>
                <div className="space-y-4 text-center md:text-left">
                  <div>
                    <h2 className="text-3xl font-headline font-bold text-secondary">Un Jardin pour Félix</h2>
                    <p className="text-muted-foreground font-medium">Marché de Noël Solidaire - Chazay d'Azergues</p>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    L'association « Un jardin pour Félix » a été créé en 2014 par les parents de Félix. Il est atteint d'une maladie génétique rare le syndrome POTOCKI LUPSKI et d'un trouble autistique très envahissant. L'association permet de financer des intervenants à domicile pour le stimuler et le faire progresser au quotidien.
                  </p>
                  <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-2">
                    <Button variant="outline" size="sm" className="gap-2 border-secondary text-secondary hover:bg-secondary/10" asChild>
                      <a href="https://unjardinpourfelix.com" target="_blank" rel="noopener noreferrer">
                        <Info className="w-4 h-4" /> Blog de Félix
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 border-primary text-primary hover:bg-primary/10" asChild>
                      <a href="https://www.lemarchedefelix.com/" target="_blank" rel="noopener noreferrer">
                        <ShoppingBag className="w-4 h-4" /> Boutique Solidaire
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t bg-primary text-primary-foreground text-center">
        <p className="text-sm opacity-80">© {marketYear} Association "Un jardin pour Félix" - Chazay d'Azergues</p>
      </footer>
    </div>
  );
}
