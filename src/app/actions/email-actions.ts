'use server';

import nodemailer from 'nodemailer';
import { headers } from 'next/headers';

/**
 * Récupère la base URL de manière dynamique pour les liens dans les emails.
 */
async function getBaseUrl() {
  try {
    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host') || '';
    
    if (host && !host.includes('127.0.0.1') && !host.includes('localhost')) {
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

/**
 * Nettoie les chaînes pour éviter les problèmes d'encodage avec Gmail.
 */
function stripAccents(str: string = "") {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "");
}

/**
 * Configuration du transporteur Gmail.
 */
function createTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "hugues.rabier@gmail.com",
      pass: "fcmnbojqjvbxbeqg",
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
}

/**
 * Fonction de notification d'une nouvelle candidature pour l'admin.
 */
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
    console.error('SMTP Error (Notification):', error);
    return { success: false, error: error.message };
  }
}

/**
 * Envoie l'email d'acceptation (Etape 1).
 */
export async function sendAcceptanceEmail(exhibitor: any, customMessage: string, marketConfig: any) {
  const transporter = createTransporter();
  const baseUrl = await getBaseUrl();
  const detailsLink = `${baseUrl}/details/${exhibitor.id}`;
  const year = marketConfig?.marketYear || '2026';

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
    console.error('SMTP Error (Acceptance):', error);
    return { success: false, error: error.message };
  }
}

/**
 * Envoie l'email de refus.
 */
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
    console.error('SMTP Error (Rejection):', error);
    return { success: false, error: error.message };
  }
}

/**
 * Envoie l'email de confirmation finale après dossier technique.
 */
export async function sendFinalConfirmationEmail(exhibitor: any, details: any, marketConfig: any) {
  const transporter = createTransporter();
  const year = marketConfig?.marketYear || '2026';
  
  const standPrice = exhibitor.requestedTables === '1' ? (marketConfig?.priceTable1 ?? 40) : (marketConfig?.priceTable2 ?? 60);
  const electricityPrice = details.needsElectricity ? (marketConfig?.priceElectricity ?? 1) : 0;
  const mealsPrice = (details.sundayLunchCount || 0) * (marketConfig?.priceMeal ?? 8);
  const total = standPrice + electricityPrice + mealsPrice;

  const satDate = stripAccents(marketConfig?.saturdayDate || "5/12/2026");
  const satHours = stripAccents(marketConfig?.saturdayHours || "14h à 19h");
  const sunDate = stripAccents(marketConfig?.sundayDate || "06/12/2026");
  const sunHours = stripAccents(marketConfig?.sundayHours || "10h à 17h30");

  const mailText = `Bonjour ${stripAccents(exhibitor.firstName)} ${stripAccents(exhibitor.lastName)},

Dossier technique recu pour le Marche de Noel ${year}.

DETAIL DU REGLEMENT :
- Emplacement : ${standPrice} EUR (${exhibitor.requestedTables} table(s))
- Electricite : ${electricityPrice} EUR
- Repas : ${mealsPrice} EUR

MONTANT TOTAL A REGLER : ${total} EUR

Pour confirmer definitivement votre place, merci d'envoyer votre cheque libelle a l'ordre de "Les amis d'un Jardin pour Felix" a l'adresse suivante : 30 rue du Colombier 69380 CHAZAY D'AZERGUES.
Le cheque doit nous parvenir dans les 15 jours apres la reception de cet email. Il sera encaisse 15 jours avant l'evenement.

Rappel des dates et heures : samedi ${satDate} de ${satHours} et le dimanche ${sunDate} de ${sunHours} a la salle Maurice Baquet, rue Pierre Coubertin

L'equipe "Un jardin pour Felix"`;

  const mailOptions = {
    from: `"Le Marche de Felix" <hugues.rabier@gmail.com>`,
    to: exhibitor.email,
    subject: `Confirmation dossier - ${stripAccents(exhibitor.companyName)}`,
    text: mailText,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error: any) {
    console.error('SMTP Error (Final):', error);
    return { success: false, error: error.message };
  }
}

/**
 * Envoie un email groupé.
 */
export async function sendBulkEmailAction(emails: string[], subject: string, body: string) {
  const transporter = createTransporter();
  const cleanedSubject = stripAccents(subject);
  const plainTextBody = body.replace(/<[^>]*>?/gm, '');

  const results = await Promise.all(emails.map(async (email) => {
    const mailOptions = {
      from: `"Le Marche de Felix" <hugues.rabier@gmail.com>`,
      to: email,
      subject: cleanedSubject,
      text: plainTextBody,
      html: body,
    };
    try {
      await transporter.sendMail(mailOptions);
      return { email, success: true };
    } catch (error: any) {
      console.error(`Bulk Email Error for ${email}:`, error);
      return { email, success: false, error: error.message };
    }
  }));

  const failed = results.filter(r => !r.success);
  return { 
    success: failed.length === 0, 
    totalSent: results.length - failed.length,
    totalFailed: failed.length,
    failedEmails: failed.map(f => f.email)
  };
}

/**
 * Envoie un email de test.
 */
export async function sendTestEmailAction(to: string, subject: string, body: string) {
  const transporter = createTransporter();
  const cleanedSubject = `[TEST] ${stripAccents(subject)}`;
  const plainTextBody = body.replace(/<[^>]*>?/gm, '');

  const mailOptions = {
    from: `"Le Marche de Felix" <hugues.rabier@gmail.com>`,
    to: to,
    subject: cleanedSubject,
    text: plainTextBody,
    html: body,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error: any) {
    console.error(`Test Email Error:`, error);
    return { success: false, error: error.message };
  }
}
