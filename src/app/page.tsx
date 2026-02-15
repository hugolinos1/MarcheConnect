
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { Gift, TreePine, Star, ChevronRight } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative">
      <ChristmasSnow />
      
      {/* Header */}
      <header className="border-b bg-white/50 backdrop-blur-md sticky top-0 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TreePine className="text-secondary w-8 h-8" />
            <span className="font-headline font-bold text-xl tracking-tight text-primary">MarchéConnect</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/admin" className="text-sm font-medium hover:text-primary transition-colors">Portail Admin</Link>
            <Button asChild variant="default" className="bg-primary hover:bg-primary/90">
              <Link href="/register">S'inscrire</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-20 overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent text-accent-foreground text-xs font-semibold uppercase tracking-wider">
                  <Star className="w-3 h-3 fill-accent" />
                  Edition Noël 2024
                </div>
                <h1 className="text-5xl lg:text-7xl font-headline font-bold text-primary leading-tight">
                  Rejoignez la Magie de notre Marché de Noël
                </h1>
                <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
                  Devenez exposant au cœur de l'événement le plus attendu de l'hiver. Déposez votre candidature en quelques clics.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                  <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-white gold-glow w-full sm:w-auto">
                    <Link href="/register" className="gap-2">
                      Déposer ma candidature <ChevronRight className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="border-secondary text-secondary hover:bg-secondary/10 w-full sm:w-auto">
                    <Link href="/admin">Accès Organisateur</Link>
                  </Button>
                </div>
              </div>
              <div className="flex-1 relative">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl rotate-2">
                  <Image 
                    src="https://images.unsplash.com/photo-1543259565-2bc8ca966bb0?q=80&w=1200&h=600&auto=format&fit=crop"
                    alt="Marché de Noël"
                    fill
                    className="object-cover"
                    data-ai-hint="christmas market"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent" />
                </div>
                <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-xl shadow-xl flex items-center gap-4 animate-bounce">
                  <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                    <Gift className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-primary">Places limitées !</p>
                    <p className="text-sm text-muted-foreground">Postulez dès aujourd'hui</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-secondary/5">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl font-headline font-bold text-secondary">Pourquoi nous rejoindre ?</h2>
              <div className="w-24 h-1 bg-accent mx-auto" />
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: <TreePine className="w-8 h-8 text-secondary" />,
                  title: "Emplacement Premium",
                  desc: "Nos chalets sont situés au cœur du flux touristique."
                },
                {
                  icon: <Star className="w-8 h-8 text-accent" />,
                  title: "Visibilité Maximale",
                  desc: "Une campagne de communication d'envergure pour l'événement."
                },
                {
                  icon: <Gift className="w-8 h-8 text-primary" />,
                  title: "Ambiance Festive",
                  desc: "Un décor féérique soigné pour mettre en valeur vos produits."
                }
              ].map((f, i) => (
                <div key={i} className="bg-white p-8 rounded-2xl shadow-sm border hover:shadow-md transition-shadow text-center space-y-4">
                  <div className="inline-flex p-3 rounded-xl bg-muted/50 mb-2">
                    {f.icon}
                  </div>
                  <h3 className="text-xl font-headline font-semibold text-foreground">{f.title}</h3>
                  <p className="text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t bg-secondary text-secondary-foreground">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <TreePine className="w-6 h-6" />
            <span className="font-headline font-bold text-lg">MarchéConnect</span>
          </div>
          <p className="text-sm opacity-80">© 2024 Comité d'Organisation du Marché de Noël</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="text-sm hover:underline">Mentions légales</Link>
            <Link href="/contact" className="text-sm hover:underline">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
