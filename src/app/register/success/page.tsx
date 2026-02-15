
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { CheckCircle, ArrowLeft, TreePine } from 'lucide-react';

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
      <ChristmasSnow />
      <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="mx-auto w-24 h-24 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
          <CheckCircle className="w-16 h-16" />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-headline font-bold text-primary">Merci !</h1>
          <p className="text-lg text-muted-foreground">
            Votre pré-inscription a bien été reçue. Notre équipe va examiner votre projet et vous recevrez une réponse par email très prochainement.
          </p>
        </div>
        <div className="p-6 bg-white rounded-2xl shadow-sm border space-y-4">
          <div className="flex items-center gap-2 justify-center text-secondary font-semibold">
            <TreePine className="w-5 h-5" /> Prochaines étapes
          </div>
          <p className="text-sm text-muted-foreground">
            Si votre candidature est retenue, vous recevrez un lien unique pour compléter votre dossier administratif.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/"><ArrowLeft className="w-4 h-4" /> Retour à l'accueil</Link>
        </Button>
      </div>
    </div>
  );
}
