'use server';
/**
 * @fileOverview A GenAI tool to assist administrators in drafting personalized and well-reasoned rejection messages for exhibitor applications.
 *
 * - generateRejectionJustification - A function that generates a rejection justification message.
 * - GenerateRejectionJustificationInput - The input type for the generateRejectionJustification function.
 * - GenerateRejectionJustificationOutput - The return type for the generateRejectionJustification function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateRejectionJustificationInputSchema = z.object({
  applicantName: z.string().describe("The name of the applicant to address in the justification."),
  applicationSummary: z
    .string()
    .describe("A summary of the exhibitor's application, including their proposed products, services, or booth concept."),
  rejectionReasons: z
    .array(z.string())
    .describe("A list of specific reasons why the application is being rejected. Examples: 'Not enough space', 'Product category already saturated', 'Does not align with market theme'.")
    .min(1, "At least one rejection reason must be provided."),
});
export type GenerateRejectionJustificationInput = z.infer<typeof GenerateRejectionJustificationInputSchema>;

const GenerateRejectionJustificationOutputSchema = z.object({
  justificationMessage: z
    .string()
    .describe("A personalized and well-reasoned message justifying the rejection of the exhibitor's application."),
});
export type GenerateRejectionJustificationOutput = z.infer<typeof GenerateRejectionJustificationOutputSchema>;

const rejectionJustificationPrompt = ai.definePrompt({
  name: 'generateRejectionJustificationPrompt',
  input: {schema: GenerateRejectionJustificationInputSchema},
  output: {schema: GenerateRejectionJustificationOutputSchema},
  prompt: `You are an AI assistant tasked with generating personalized and well-reasoned rejection messages for exhibitor applications for a Christmas market.
The goal is to provide clear, empathetic, and constructive feedback while maintaining a polite tone.

Applicant Name: {{{applicantName}}}
Application Summary: {{{applicationSummary}}}
Rejection Reasons:
{{#each rejectionReasons}}- {{{this}}}
{{/each}}

Based on the provided information, please generate a justification message for the rejection.
The message should:
1. Address the applicant by their name.
2. Politely state that their application cannot be accepted at this time.
3. Clearly and concisely explain the reasons for rejection, referencing the provided 'Rejection Reasons'.
4. Avoid overly harsh or accusatory language.
5. Suggest possible improvements or alternative opportunities if appropriate (e.g., applying next year, different market type), but only if the reasons allow for it.
6. Conclude with a polite closing.

Ensure the output is a JSON object with a single field: "justificationMessage".`,
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
