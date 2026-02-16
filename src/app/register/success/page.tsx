
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { CheckCircle, ArrowLeft, TreePine, Mail, ShieldCheck } from 'lucide-react';

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const isFinal = resolvedParams.type === 'final';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
      < ChristmasSnow />
      <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="mx-auto w-24 h-24 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
          <CheckCircle className="w-16 h-16" />
        </div>
        
        <div className="space-y-4">
          <h1 className="text-4xl font-headline font-bold text-primary">Merci !</h1>
          <p className="text-lg text-muted-foreground">
            {isFinal 
              ? "Votre dossier de finalisation a bien été reçu. Vos informations techniques sont enregistrées." 
              : "Votre pré-inscription a bien été reçue. Notre équipe va examiner votre projet."}
          </p>
          {!isFinal && (
            <p className="text-sm text-muted-foreground/80">
              Vous recevrez une réponse par email très prochainement concernant l'étude de votre candidature.
            </p>
          )}
        </div>

        <div className="p-6 bg-white rounded-2xl shadow-sm border space-y-4 border-primary/10">
          <div className="flex items-center gap-2 justify-center text-secondary font-bold uppercase tracking-wider text-sm">
            {isFinal ? <ShieldCheck className="w-5 h-5" /> : <TreePine className="w-5 h-5" />}
            {isFinal ? "Règlement & Validation" : "Prochaines étapes"}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isFinal 
              ? "Votre inscription sera définitivement confirmée à réception de votre règlement par chèque. Une confirmation finale vous sera envoyée par e-mail."
              : "Si votre candidature est retenue, vous recevrez un lien unique pour compléter votre dossier technique et administratif."}
          </p>
          {isFinal && (
            <div className="bg-primary/5 p-3 rounded-lg flex items-center gap-2 text-xs text-primary font-medium">
              <Mail className="w-4 h-4" /> Un e-mail récapitulatif vous a été envoyé.
            </div>
          )}
        </div>

        <Button asChild variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5">
          <Link href="/"><ArrowLeft className="w-4 h-4" /> Retour à l'accueil</Link>
        </Button>
      </div>
    </div>
  );
}
