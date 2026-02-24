'use server';

import nodemailer from 'nodemailer';
import { headers } from 'next/headers';

/**
 * Récupère la base URL de manière dynamique pour les liens dans les emails.
 * Privilégie le domaine de production ou le domaine actuel du studio.
 */
async function getBaseUrl() {
  try {
    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host') || '';
    
    // On détecte si on est sur un domaine personnalisé (production ou studio port-forwarded)
    if (host && !host.includes('127.0.0.1') && !host.includes('localhost')) {
      let protocol = headersList.get('x-forwarded-proto') || 'https';
      if (protocol.includes(',')) {
        protocol = protocol.split(',')[0].trim();
      }
      return `${protocol}://${host}`;
    }

    // URL par défaut si détection locale
    return 'https://marche-connect.web.app';
  } catch (e) {
    return 'https://marche-connect.web.app';
  }
}

/**
 * Nettoie les chaînes pour éviter les problèmes d'encodage avec certains serveurs SMTP.
 */
function stripAccents(str: string = "") {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
    .replace(/[^\x00-\x7F]/g, "");    // Supprime les caractères non-ASCII
}

/**
 * Configuration du transporteur Gmail.
 * Utilise le mot de passe d'application généré par l'utilisateur.
 */
function createTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "hugues.rabier@gmail.com",
      pass: "fcmnbojqjvbxbeqg", // MOT DE PASSE D'APPLICATION GMAIL
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
}

/**
 * Fonction de test SMTP Gmail.
 */
export async function testSmtpGmail() {
  const transporter = createTransporter();
  const mailOptions = {
    from: `"Test MarcheConnect" <hugues.rabier@gmail.com>`,
    to: "hugues.rabier@gmail.com",
    subject: "Test SMTP Gmail Reussi",
    text: "Ceci est un test de connexion SMTP Gmail depuis l'application MarcheConnect avec le nouveau mot de passe d'application.",
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error: any) {
    console.error('SMTP Test Error:', error);
    return { success: false, error: error.message };
  }
}

export async function sendAcceptanceEmail(exhibitor: any, customMessage: string, marketConfig: any) {
  const transporter = createTransporter();
  const year = marketConfig?.marketYear || '2026';
  const baseUrl = await getBaseUrl();
  const detailsLink = `${baseUrl}/details/${exhibitor.id}`;

  const firstName = stripAccents(exhibitor.firstName);
  const lastName = stripAccents(exhibitor.lastName);
  const messagePerso = stripAccents(customMessage);

  const mailOptions = {
    from: `"Le Marche de Felix" <hugues.rabier@gmail.com>`,
    to: exhibitor.email,
    subject: `Candidature retenue - Marche de Noel ${year}`,
    text: `Bonjour ${firstName} ${lastName},

Nous avons le plaisir de vous informer que votre candidature pour le Marche de Noel ${year} a ete acceptee.

${messagePerso ? `Note de l'organisateur :\n---------------------------\n${messagePerso}\n---------------------------\n` : ''}

Pour finaliser votre inscription, merci de completer votre dossier technique en cliquant sur le lien ci-dessous :

Lien : ${detailsLink}

A bientot !
L'equipe "Un jardin pour Felix"`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error: any) {
    console.error('SMTP Error:', error);
    return { success: false, error: error.message };
  }
}

export async function sendRejectionEmail(exhibitor: any, justification: string, marketConfig: any) {
  const transporter = createTransporter();
  const year = marketConfig?.marketYear || '2026';
  const firstName = stripAccents(exhibitor.firstName);
  const lastName = stripAccents(exhibitor.lastName);
  const reason = stripAccents(justification);

  const mailOptions = {
    from: `"Le Marche de Felix" <hugues.rabier@gmail.com>`,
    to: exhibitor.email,
    subject: `Candidature Marche de Noel ${year}`,
    text: `Bonjour ${firstName} ${lastName},

Nous ne pouvons malheureusement pas retenir votre candidature pour l'edition ${year}.

Motif :
---------------------------
${reason}
---------------------------

Bonne continuation.`,
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
  const company = stripAccents(exhibitorData.companyName);

  const mailOptions = {
    from: `"MarcheConnect" <hugues.rabier@gmail.com>`,
    to: notificationEmail,
    subject: `Nouvelle Candidature : ${company}`,
    text: `Nouvelle candidature pour le Marche de Noel ${year}.\n\nEnseigne : ${company}\nContact : ${stripAccents(exhibitorData.firstName)} ${stripAccents(exhibitorData.lastName)}`,
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
  const total = (exhibitor.requestedTables === '1' ? (marketConfig?.priceTable1 ?? 40) : (marketConfig?.priceTable2 ?? 60)) + ((details.sundayLunchCount || 0) * (marketConfig?.priceMeal ?? 8));

  const mailOptions = {
    from: `"Le Marche de Felix" <hugues.rabier@gmail.com>`,
    to: exhibitor.email,
    subject: `Confirmation dossier - ${stripAccents(exhibitor.companyName)}`,
    text: `Bonjour ${stripAccents(exhibitor.firstName)} ${stripAccents(exhibitor.lastName)},

Dossier technique recu pour le Marche de Noel ${year}.

MONTANT TOTAL A REGLER : ${total} EUR

Merci d'envoyer votre cheque pour confirmer definitivement votre place.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
