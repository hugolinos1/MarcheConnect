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
    from: `"Test MarcheConnect" <rabier.hugues@orange.fr>`,
    to: "hugues.rabier@gmail.com",
    subject: "Test SMTP Orange Reussi",
    text: "Ceci est un test de connexion SMTP depuis l'application MarcheConnect.",
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

  // Format ultra-simplifié sans accents dans les headers pour éviter le rejet OFR_997 d'Orange
  const mailOptions = {
    from: `"Le Marche de Felix" <rabier.hugues@orange.fr>`,
    to: exhibitor.email,
    subject: `Candidature retenue - Marche de Noel ${year}`,
    text: `Bonjour ${exhibitor.firstName} ${exhibitor.lastName},

Nous avons le plaisir de vous informer que votre candidature pour le Marche de Noel ${year} "Un jardin pour Felix" a ete acceptee !

${customMessage ? `Note de l'organisateur :\n---------------------------\n${customMessage}\n---------------------------\n` : ''}

Pour finaliser votre inscription, merci de completer votre dossier technique en cliquant sur le lien ci-dessous :

Lien vers votre dossier : ${detailsLink}

A tres bientot !
L'equipe "Un jardin pour Felix"`,
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
    from: `"Le Marche de Felix" <rabier.hugues@orange.fr>`,
    to: exhibitor.email,
    subject: `Candidature Marche de Noel ${year}`,
    text: `Bonjour ${exhibitor.firstName} ${exhibitor.lastName},

Nous vous remercions de l'interet porte a notre marche solidaire.

Apres etude de votre dossier, nous ne pouvons malheureusement pas retenir votre candidature pour l'edition ${year}.

Motif :
---------------------------
${justification}
---------------------------

Bonne continuation.
L'equipe "Un jardin pour Felix"`,
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
    from: `"MarcheConnect" <rabier.hugues@orange.fr>`,
    to: notificationEmail,
    subject: `Nouvelle Candidature : ${exhibitorData.companyName}`,
    text: `Nouvelle candidature pour le Marche de Noel ${year}.\n\nEnseigne : ${exhibitorData.companyName}\nContact : ${exhibitorData.firstName} ${exhibitorData.lastName}\nEmail : ${exhibitorData.email}`,
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
    from: `"Le Marche de Felix" <rabier.hugues@orange.fr>`,
    to: exhibitor.email,
    subject: `Confirmation dossier technique - ${exhibitor.companyName}`,
    text: `Bonjour ${exhibitor.firstName} ${exhibitor.lastName},

Nous avons bien recu votre dossier technique final pour le Marche de Noel ${year}.

Recapitulatif :
---------------------------
Enseigne : ${exhibitor.companyName}
Tables : ${exhibitor.requestedTables}
Repas : ${details.sundayLunchCount}
Electricite : ${details.needsElectricity ? 'Oui' : 'Non'}

MONTANT TOTAL A REGLER : ${total} EUR

Merci d'envoyer votre cheque a l'ordre de "Association Un Jardin pour Felix" pour confirmer definitivement votre place.

L'equipe "Un jardin pour Felix"`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}