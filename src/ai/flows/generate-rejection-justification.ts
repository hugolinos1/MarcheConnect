'use server';
/**
 * @fileOverview Un outil d'IA pour aider les administrateurs à rédiger des messages de refus personnalisés et argumentés pour les candidatures d'exposants.
 *
 * - generateRejectionJustification - Une fonction qui génère un message de justification de refus.
 * - GenerateRejectionJustificationInput - Le type d'entrée pour la fonction generateRejectionJustification.
 * - GenerateRejectionJustificationOutput - Le type de sortie pour la fonction generateRejectionJustification.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateRejectionJustificationInputSchema = z.object({
  applicantName: z.string().describe("Le nom du candidat à qui adresser la justification."),
  applicationSummary: z
    .string()
    .describe("Un résumé de la candidature de l'exposant, incluant ses produits, services ou concept de stand."),
  rejectionReasons: z
    .array(z.string())
    .describe("Une liste de raisons spécifiques pour lesquelles la candidature est refusée. Exemples : 'Manque de place', 'Catégorie de produits déjà saturée', 'Ne correspond pas au thème du marché'.")
    .min(1, "Au moins une raison de refus doit être fournie."),
});
export type GenerateRejectionJustificationInput = z.infer<typeof GenerateRejectionJustificationInputSchema>;

const GenerateRejectionJustificationOutputSchema = z.object({
  justificationMessage: z
    .string()
    .describe("Un message personnalisé et argumenté justifiant le refus de la candidature de l'exposant, rédigé en français."),
});
export type GenerateRejectionJustificationOutput = z.infer<typeof GenerateRejectionJustificationOutputSchema>;

const rejectionJustificationPrompt = ai.definePrompt({
  name: 'generateRejectionJustificationPrompt',
  input: {schema: GenerateRejectionJustificationInputSchema},
  output: {schema: GenerateRejectionJustificationOutputSchema},
  prompt: `Vous êtes un assistant IA chargé de générer des messages de refus personnalisés et argumentés pour les candidatures d'exposants à un marché de Noël solidaire.
L'objectif est de fournir un retour clair, empathique et constructif tout en maintenant un ton poli et chaleureux.

IMPORTANT : Le message doit être rédigé EN FRANÇAIS.

Nom du candidat : {{{applicantName}}}
Résumé de la candidature : {{{applicationSummary}}}
Raisons du refus :
{{#each rejectionReasons}}- {{{this}}}
{{/each}}

En vous basant sur les informations fournies, veuillez générer un message de justification pour le refus.
Le message doit :
1. S'adresser au candidat par son nom.
2. Indiquer poliment que sa candidature ne peut pas être retenue pour le moment.
3. Expliquer de manière claire et concise les raisons du refus, en faisant référence aux "Raisons du refus" fournies.
4. Éviter un langage trop dur ou accusateur.
5. Suggérer des améliorations possibles ou d'autres opportunités si approprié (ex: postuler l'année prochaine), mais seulement si les raisons le permettent.
6. Conclure par une formule de politesse.

Assurez-vous que la sortie est un objet JSON avec un seul champ : "justificationMessage".`,
});

const generateRejectionJustificationFlow = ai.defineFlow(
  {
    name: 'generateRejectionJustificationFlow',
    inputSchema: GenerateRejectionJustificationInputSchema,
    outputSchema: GenerateRejectionJustificationOutputSchema,
  },
  async (input) => {
    const {output} = await rejectionJustificationPrompt(input);
    return output!;
  }
);

export async function generateRejectionJustification(
  input: GenerateRejectionJustificationInput
): Promise<GenerateRejectionJustificationOutput> {
  return generateRejectionJustificationFlow(input);
}
