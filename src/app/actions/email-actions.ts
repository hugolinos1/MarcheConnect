
'use server';

import nodemailer from 'nodemailer';

/**
 * Action serveur pour envoyer une notification par e-mail lors d'une nouvelle candidature.
 */
export async function sendApplicationNotification(exhibitorData: any) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_USE_SSL === 'True',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Marché de Félix" <${process.env.EMAIL_USER}>`,
    to: "rabier.hugues@orange.fr",
    subject: `Nouvelle Candidature : ${exhibitorData.companyName}`,
    text: `Bonjour,

Une nouvelle candidature vient d'être déposée pour le Marché de Noël 2026.

Détails de l'exposant :
-----------------------
Enseigne : ${exhibitorData.companyName}
Contact : ${exhibitorData.firstName} ${exhibitorData.lastName}
Ville : ${exhibitorData.city} (${exhibitorData.postalCode})
Email : ${exhibitorData.email}
Téléphone : ${exhibitorData.phone}

Description du stand :
${exhibitorData.productDescription}

Tables demandées : ${exhibitorData.requestedTables}
Statut Pro : ${exhibitorData.isRegistered ? 'Déclaré' : 'Particulier'}
Site/Réseaux : ${exhibitorData.websiteUrl || 'Non renseigné'}

Vous pouvez consulter le dossier complet sur votre tableau de bord administrateur.

-- 
Système de gestion MarchéConnect
`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'e-mail notification:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

/**
 * Action serveur pour envoyer l'e-mail d'acceptation avec lien de finalisation.
 */
export async function sendAcceptanceEmail(exhibitor: any, customMessage: string) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_USE_SSL === 'True',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  // Utilisation de l'origine de la requête pour construire le lien
  // En production, il faudra configurer NEXT_PUBLIC_BASE_URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';
  const detailsLink = `${baseUrl}/details/${exhibitor.id}`;

  const mailOptions = {
    from: `"Marché de Félix" <${process.env.EMAIL_USER}>`,
    to: exhibitor.email,
    cc: "rabier.hugues@orange.fr", // Copie de confirmation pour l'admin
    subject: `Votre candidature pour le Marché de Félix 2026 a été retenue !`,
    text: `Bonjour ${exhibitor.firstName} ${exhibitor.lastName},

Nous avons le plaisir de vous informer que votre candidature pour le Marché de Noël 2026 "Un jardin pour Félix" a été acceptée par notre comité !

${customMessage ? `Message de l'organisateur :\n---------------------------\n${customMessage}\n---------------------------\n` : ''}

Pour finaliser officiellement votre inscription, merci de compléter votre dossier technique (électricité, repas, assurance) en cliquant sur le lien ci-dessous :

Lien vers votre dossier : ${detailsLink}

Une fois ce dossier complété, votre emplacement sera définitivement réservé à réception de votre règlement par chèque.

À très bientôt pour préparer cette belle édition solidaire !

L'équipe de l'association "Un jardin pour Félix"
`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Erreur envoi mail acceptation:', error);
    return { success: false, error: 'Failed to send acceptance email' };
  }
}
