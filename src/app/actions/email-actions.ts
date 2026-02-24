'use server';

import nodemailer from 'nodemailer';
import { headers } from 'next/headers';

/**
 * Récupère la base URL de manière dynamique.
 */
async function getBaseUrl() {
  try {
    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host') || '';
    
    if (host && !host.includes('127.0.0.1') && !host.includes('localhost') && !host.includes('9002')) {
      let protocol = headersList.get('x-forwarded-proto') || 'https';
      if (protocol.includes(',')) {
        protocol = protocol.split(',')[0].trim();
      }
      return `${protocol}://${host}`;
    }

    return 'https://marche-connect.web.app';
  } catch (e) {
    return 'https://marche-connect.web.app';
  }
}

function createTransporter() {
  return nodemailer.createTransport({
    host: "smtp.orange.fr",
    port: 465,
    secure: true,
    auth: {
      user: "rabier.hugues@orange.fr",
      pass: "Ptmee52r2ora2!",
    },
    // Timeouts optimisés pour Orange
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

/**
 * Fonction de test SMTP simple qui a été confirmée comme fonctionnelle.
 */
export async function testSmtpOrange() {
  const transporter = createTransporter();
  const mailOptions = {
    from: `"Test MarchéConnect" <rabier.hugues@orange.fr>`,
    to: "hugues.rabier@gmail.com",
    subject: "Test SMTP Orange Réussi",
    text: "Ceci est un test de connexion SMTP depuis l'application MarchéConnect.",
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendAcceptanceEmail(exhibitor: any, customMessage: string, marketConfig: any) {
  const transporter = createTransporter();
  const year = marketConfig?.marketYear || '2026';
  const baseUrl = await getBaseUrl();
  const detailsLink = `${baseUrl}/details/${exhibitor.id}`;

  // Format simplifié au maximum pour éviter le rejet OFR_997 d'Orange (plus de CC)
  const mailOptions = {
    from: `"Le Marché de Félix" <rabier.hugues@orange.fr>`,
    to: exhibitor.email,
    subject: `Candidature retenue - Marché de Noël ${year}`,
    text: `Bonjour ${exhibitor.firstName} ${exhibitor.lastName},

Nous avons le plaisir de vous informer que votre candidature pour le Marché de Noël ${year} "Un jardin pour Félix" a été acceptée !

${customMessage ? `Note de l'organisateur :\n---------------------------\n${customMessage}\n---------------------------\n` : ''}

Pour finaliser votre inscription, merci de compléter votre dossier technique en cliquant sur le lien ci-dessous :

Lien vers votre dossier : ${detailsLink}

À très bientôt !
L'équipe "Un jardin pour Félix"`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error: any) {
    console.error('SMTP Error details:', error);
    return { success: false, error: error.message };
  }
}

export async function sendRejectionEmail(exhibitor: any, justification: string, marketConfig: any) {
  const transporter = createTransporter();
  const year = marketConfig?.marketYear || '2026';

  const mailOptions = {
    from: `"Le Marché de Félix" <rabier.hugues@orange.fr>`,
    to: exhibitor.email,
    subject: `Candidature Marché de Noël ${year}`,
    text: `Bonjour ${exhibitor.firstName} ${exhibitor.lastName},

Nous vous remercions de l'intérêt porté à notre marché solidaire.

Après étude de votre dossier, nous ne pouvons malheureusement pas retenir votre candidature pour l'édition ${year}.

Motif :
---------------------------
${justification}
---------------------------

Bonne continuation.
L'équipe "Un jardin pour Félix"`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendApplicationNotification(exhibitorData: any, marketConfig: any) {
  const transporter = createTransporter();
  const year = marketConfig?.marketYear || '2026';
  const notificationEmail = marketConfig?.notificationEmail || "lemarchedefelix2020@gmail.com";

  const mailOptions = {
    from: `"MarchéConnect" <rabier.hugues@orange.fr>`,
    to: notificationEmail,
    subject: `Nouvelle Candidature : ${exhibitorData.companyName}`,
    text: `Nouvelle candidature pour le Marché de Noël ${year}.\n\nEnseigne : ${exhibitorData.companyName}\nContact : ${exhibitorData.firstName} ${exhibitorData.lastName}\nEmail : ${exhibitorData.email}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendFinalConfirmationEmail(exhibitor: any, details: any, marketConfig: any) {
  const transporter = createTransporter();
  const year = marketConfig?.marketYear || '2026';

  const standPrice = exhibitor.requestedTables === '1' ? (marketConfig?.priceTable1 ?? 40) : (marketConfig?.priceTable2 ?? 60);
  const total = standPrice + ((details.sundayLunchCount || 0) * (marketConfig?.priceMeal ?? 8));

  const mailOptions = {
    from: `"Le Marché de Félix" <rabier.hugues@orange.fr>`,
    to: exhibitor.email,
    subject: `Confirmation dossier technique - ${exhibitor.companyName}`,
    text: `Bonjour ${exhibitor.firstName} ${exhibitor.lastName},

Nous avons bien reçu votre dossier technique final pour le Marché de Noël ${year}.

Récapitulatif :
---------------------------
Enseigne : ${exhibitor.companyName}
Tables : ${exhibitor.requestedTables}
Repas : ${details.sundayLunchCount}
Electricité : ${details.needsElectricity ? 'Oui' : 'Non'}

MONTANT TOTAL À RÉGLER : ${total} €

Merci d'envoyer votre chèque à l'ordre de "Association Un Jardin pour Félix" pour confirmer définitivement votre place.

L'équipe "Un jardin pour Félix"`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}