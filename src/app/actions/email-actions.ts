
'use server';

import nodemailer from 'nodemailer';

/**
 * Action serveur pour envoyer une notification par e-mail lors d'une nouvelle candidature.
 */
export async function sendApplicationNotification(exhibitorData: any) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_USE_SSL === 'True', // true pour le port 465
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
