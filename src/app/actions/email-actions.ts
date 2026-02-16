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
    from: `"Le Marché de Félix" <${process.env.EMAIL_USER}>`,
    to: "lemarchedefelix2020@gmail.com",
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

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';
  const detailsLink = `${baseUrl}/details/${exhibitor.id}`;

  const mailOptions = {
    from: `"Le Marché de Félix" <${process.env.EMAIL_USER}>`,
    to: exhibitor.email,
    cc: "lemarchedefelix2020@gmail.com",
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

/**
 * Action serveur pour envoyer l'e-mail de refus motivé.
 */
export async function sendRejectionEmail(exhibitor: any, justification: string) {
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
    from: `"Le Marché de Félix" <${process.env.EMAIL_USER}>`,
    to: exhibitor.email,
    cc: "lemarchedefelix2020@gmail.com",
    subject: `Votre candidature pour le Marché de Noël 2026`,
    text: `Bonjour ${exhibitor.firstName} ${exhibitor.lastName},

Nous vous remercions de l'intérêt porté à notre marché solidaire "Un jardin pour Félix".

Après étude de votre dossier par notre comité de sélection, nous avons le regret de vous informer que votre candidature n'a pas pu être retenue pour cette édition 2026.

Motif de notre décision :
---------------------------
${justification}
---------------------------

Nous vous souhaitons une excellente saison de fin d'année et une bonne continuation dans vos activités.

L'équipe de l'association "Un jardin pour Félix"
`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Erreur envoi mail refus:', error);
    return { success: false, error: 'Failed to send rejection email' };
  }
}

/**
 * Action serveur pour confirmer la réception du dossier technique final.
 */
export async function sendFinalConfirmationEmail(exhibitor: any, details: any) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_USE_SSL === 'True',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const standPrice = exhibitor.requestedTables === '1' ? 40 : 60;
  const mealsPrice = details.sundayLunchCount * 8;
  const total = standPrice + mealsPrice;

  const mailOptions = {
    from: `"Le Marché de Félix" <${process.env.EMAIL_USER}>`,
    to: exhibitor.email,
    cc: "lemarchedefelix2020@gmail.com",
    subject: `Confirmation de réception de votre dossier technique - ${exhibitor.companyName}`,
    text: `Bonjour ${exhibitor.firstName} ${exhibitor.lastName},

Nous avons bien reçu votre dossier technique et de finalisation pour le Marché de Noël 2026 "Un jardin pour Félix".

Récapitulatif de vos options :
---------------------------
Enseigne : ${exhibitor.companyName}
Emplacement : ${exhibitor.requestedTables === '1' ? '1.75m (1 table)' : '3.50m (2 tables)'}
Repas Dimanche midi : ${details.sundayLunchCount}
Besoin Électricité : ${details.needsElectricity ? 'Oui (prévoir rallonges)' : 'Non'}
Lot Tombola : ${details.tombolaLot ? 'Oui - Merci !' : 'Non'}

MONTANT TOTAL À RÉGLER : ${total} €

Pour confirmer définitivement votre réservation, merci de nous faire parvenir votre chèque à l'ordre de "Association Un Jardin pour Félix" par courrier.

Une confirmation finale de réservation vous sera adressée dès réception de votre règlement.

Nous avons hâte de vous retrouver pour cette belle édition !

L'équipe de l'association "Un jardin pour Félix"
`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Erreur envoi mail confirmation finale:', error);
    return { success: false, error: 'Failed to send final confirmation email' };
  }
}
