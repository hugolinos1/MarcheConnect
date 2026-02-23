'use server';

import nodemailer from 'nodemailer';
import { headers } from 'next/headers';

/**
 * Récupère la base URL de manière dynamique et robuste.
 * Utilise les headers de proxy fournis par App Hosting / Vercel.
 */
async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'marche-connect.web.app';
  let protocol = headersList.get('x-forwarded-proto') || (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https');
  
  // Nettoyage si plusieurs valeurs (ex: "https,http")
  if (protocol.includes(',')) {
    protocol = protocol.split(',')[0].trim();
  }
  
  // Forcer HTTPS en production si on est sur un domaine non-local
  if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
    protocol = 'https';
  }
  
  return `${protocol}://${host}`;
}

export async function sendApplicationNotification(exhibitorData: any, marketConfig: any) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_USE_SSL === 'True',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const year = marketConfig?.marketYear || '2026';
  const notificationEmail = marketConfig?.notificationEmail || "lemarchedefelix2020@gmail.com";

  const mailOptions = {
    from: `"Le Marché de Félix" <${process.env.EMAIL_USER}>`,
    to: notificationEmail,
    subject: `Nouvelle Candidature : ${exhibitorData.companyName}`,
    text: `Bonjour,

Une nouvelle candidature vient d'être déposée pour le Marché de Noël ${year}.

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

-- 
Système MarchéConnect
`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Erreur notification email:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

export async function sendAcceptanceEmail(exhibitor: any, customMessage: string, marketConfig: any) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_USE_SSL === 'True',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const year = marketConfig?.marketYear || '2026';
  const edition = marketConfig?.editionNumber || '6ème';
  const notificationEmail = marketConfig?.notificationEmail || "lemarchedefelix2020@gmail.com";
  
  const baseUrl = await getBaseUrl();
  const detailsLink = `${baseUrl}/details/${exhibitor.id}`;

  const mailOptions = {
    from: `"Le Marché de Félix" <${process.env.EMAIL_USER}>`,
    to: exhibitor.email,
    cc: notificationEmail,
    subject: `Votre candidature pour le Marché de Félix ${year} a été retenue !`,
    text: `Bonjour ${exhibitor.firstName} ${exhibitor.lastName},

Nous avons le plaisir de vous informer que votre candidature pour le Marché de Noël ${year} "Un jardin pour Félix" (${edition} édition) a été acceptée !

${customMessage ? `Message de l'organisateur :\n---------------------------\n${customMessage}\n---------------------------\n` : ''}

Pour finaliser votre inscription, merci de compléter votre dossier technique en cliquant sur le lien ci-dessous :

Lien vers votre dossier : ${detailsLink}

À très bientôt !
L'équipe "Un jardin pour Félix"
`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Erreur mail acceptation:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

export async function sendRejectionEmail(exhibitor: any, justification: string, marketConfig: any) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_USE_SSL === 'True',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const year = marketConfig?.marketYear || '2026';
  const notificationEmail = marketConfig?.notificationEmail || "lemarchedefelix2020@gmail.com";

  const mailOptions = {
    from: `"Le Marché de Félix" <${process.env.EMAIL_USER}>`,
    to: exhibitor.email,
    cc: notificationEmail,
    subject: `Votre candidature pour le Marché de Noël ${year}`,
    text: `Bonjour ${exhibitor.firstName} ${exhibitor.lastName},

Nous vous remercions de l'intérêt porté à notre marché solidaire.

Après étude de votre dossier, nous ne pouvons malheureusement pas retenir votre candidature pour cette édition ${year}.

Motif :
---------------------------
${justification}
---------------------------

Bonne continuation.
L'équipe "Un jardin pour Félix"
`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Erreur mail refus:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

export async function sendFinalConfirmationEmail(exhibitor: any, details: any, marketConfig: any) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_USE_SSL === 'True',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const year = marketConfig?.marketYear || '2026';
  const notificationEmail = marketConfig?.notificationEmail || "lemarchedefelix2020@gmail.com";
  
  const priceTable1 = marketConfig?.priceTable1 ?? 40;
  const priceTable2 = marketConfig?.priceTable2 ?? 60;
  const priceMeal = marketConfig?.priceMeal ?? 8;

  const standPrice = exhibitor.requestedTables === '1' ? priceTable1 : priceTable2;
  const mealsPrice = (details.sundayLunchCount || 0) * priceMeal;
  const total = standPrice + mealsPrice;

  const mailOptions = {
    from: `"Le Marché de Félix" <${process.env.EMAIL_USER}>`,
    to: exhibitor.email,
    cc: notificationEmail,
    subject: `Réception de votre dossier technique - ${exhibitor.companyName}`,
    text: `Bonjour ${exhibitor.firstName} ${exhibitor.lastName},

Nous avons bien reçu votre dossier technique final pour le Marché de Noël ${year}.

Récapitulatif :
---------------------------
Enseigne : ${exhibitor.companyName}
Tables : ${exhibitor.requestedTables}
Repas : ${details.sundayLunchCount}
Electricité : ${details.needsElectricity ? 'Oui' : 'Non'}

MONTANT TOTAL À RÉGLER PAR CHÈQUE : ${total} €

Merci d'envoyer votre chèque à l'ordre de "Association Un Jardin pour Félix" sous 15 jours.

L'équipe "Un jardin pour Félix"
`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Erreur mail confirmation finale:', error);
    return { success: false, error: 'Failed to send email' };
  }
}