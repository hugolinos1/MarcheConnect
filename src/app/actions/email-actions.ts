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
 * Configuration du transporteur Gmail.
 */
function createTransporter(marketConfig?: any) {
  const user = (marketConfig?.smtpUser || process.env.SMTP_USER || "").trim();
  const pass = (marketConfig?.smtpPass || process.env.SMTP_PASS || "").trim();

  if (!user || !pass) {
    console.warn("SMTP_USER ou SMTP_PASS manquant.");
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user,
      pass: pass,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
}

/**
 * Notification d'une nouvelle candidature pour l'admin.
 */
export async function sendApplicationNotification(exhibitorData: any, marketConfig: any) {
  const transporter = createTransporter(marketConfig);
  const year = marketConfig?.marketYear || '2026';
  const notificationEmail = marketConfig?.notificationEmail || "lemarchedefelix2020@gmail.com";
  const company = exhibitorData.companyName;
  const smtpUser = (marketConfig?.smtpUser || process.env.SMTP_USER || "").trim();

  const mailOptions = {
    from: `"MarcheConnect" <${smtpUser}>`,
    to: notificationEmail,
    subject: `Nouvelle Candidature : ${company}`,
    text: `Nouvelle candidature pour le Marché de Noël ${year}.\n\nEnseigne : ${company}\nContact : ${exhibitorData.firstName} ${exhibitorData.lastName}`,
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
 * Envoie l'email d'acceptation (Étape 1).
 */
export async function sendAcceptanceEmail(exhibitor: any, customMessage: string, marketConfig: any) {
  const transporter = createTransporter(marketConfig);
  const baseUrl = await getBaseUrl();
  const detailsLink = `${baseUrl}/details/${exhibitor.id}`;
  const year = marketConfig?.marketYear || '2026';
  const smtpUser = (marketConfig?.smtpUser || process.env.SMTP_USER || "").trim();

  const mailOptions = {
    from: `"Le Marché de Félix" <${smtpUser}>`,
    to: exhibitor.email,
    subject: `Candidature retenue - Marché de Noël ${year}`,
    text: `Bonjour ${exhibitor.firstName} ${exhibitor.lastName},

Nous avons le plaisir de vous informer que votre candidature pour le Marché de Noël ${year} a été acceptée par notre comité.

${customMessage ? `Note de l'organisateur :\n---------------------------\n${customMessage}\n---------------------------\n` : ''}

Pour finaliser votre inscription, merci de compléter votre dossier technique en cliquant sur le lien ci-dessous :

Lien : ${detailsLink}

À bientôt !
L'équipe "Un jardin pour Félix"`,
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
  const transporter = createTransporter(marketConfig);
  const year = marketConfig?.marketYear || '2026';
  const smtpUser = (marketConfig?.smtpUser || process.env.SMTP_USER || "").trim();

  const mailOptions = {
    from: `"Le Marché de Félix" <${smtpUser}>`,
    to: exhibitor.email,
    subject: `Candidature Marché de Noël ${year}`,
    text: `Bonjour ${exhibitor.firstName} ${exhibitor.lastName},

Nous sommes au regret de vous indiquer que votre candidature n'a pas été retenue par notre comité pour l'édition ${year}.

Motif :
---------------------------
${justification}
---------------------------

Bonne continuation dans vos projets.
L'équipe "Un jardin pour Félix"`,
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
  const transporter = createTransporter(marketConfig);
  const year = marketConfig?.marketYear || '2026';
  const smtpUser = (marketConfig?.smtpUser || process.env.SMTP_USER || "").trim();
  
  const standPrice = exhibitor.requestedTables === '1' ? (marketConfig?.priceTable1 ?? 40) : (marketConfig?.priceTable2 ?? 60);
  const electricityPrice = details.needsElectricity ? (marketConfig?.priceElectricity ?? 1) : 0;
  const mealsPrice = (details.sundayLunchCount || 0) * (marketConfig?.priceMeal ?? 8);
  const total = standPrice + electricityPrice + mealsPrice;

  const satDate = marketConfig?.saturdayDate || "5/12/2026";
  const satHours = marketConfig?.saturdayHours || "14h à 19h";
  const sunDate = marketConfig?.sundayDate || "06/12/2026";
  const sunHours = marketConfig?.sundayHours || "10h à 17h30";

  const mailText = `Bonjour ${exhibitor.firstName} ${exhibitor.lastName},

Nous avons bien reçu votre dossier technique pour le Marché de Noël ${year}.

DÉTAIL DU RÈGLEMENT :
- Emplacement : ${standPrice} EUR (${exhibitor.requestedTables} table(s))
- Électricité : ${electricityPrice} EUR
- Repas : ${mealsPrice} EUR

MONTANT TOTAL À RÉGLER : ${total} EUR

Pour confirmer définitivement votre place, merci d'envoyer votre chèque libellé à l'ordre de "Les amis d'un Jardin pour Félix" à l'adresse suivante : 30 rue du Colombier 69380 CHAZAY D'AZERGUES.
Le chèque doit nous parvenir dans les 15 jours après la réception de cet e-mail. Il sera encaissé 15 jours avant l'événement.

Rappel des dates et heures : samedi ${satDate} de ${satHours} et le dimanche ${sunDate} de ${sunHours} à la salle Maurice Baquet, rue Pierre Coubertin.

L'équipe "Un jardin pour Félix"`;

  const mailOptions = {
    from: `"Le Marché de Félix" <${smtpUser}>`,
    to: exhibitor.email,
    subject: `Confirmation dossier - ${exhibitor.companyName}`,
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
export async function sendBulkEmailAction(emails: string[], subject: string, body: string, marketConfig: any) {
  const transporter = createTransporter(marketConfig);
  const smtpUser = (marketConfig?.smtpUser || process.env.SMTP_USER || "").trim();
  const plainTextBody = body.replace(/<[^>]*>?/gm, '');

  const results = await Promise.all(emails.map(async (email) => {
    const mailOptions = {
      from: `"Le Marché de Félix" <${smtpUser}>`,
      to: email,
      subject: subject,
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
export async function sendTestEmailAction(to: string, subject: string, body: string, marketConfig: any) {
  const transporter = createTransporter(marketConfig);
  const smtpUser = (marketConfig?.smtpUser || process.env.SMTP_USER || "").trim();
  const plainTextBody = body.replace(/<[^>]*>?/gm, '');

  const mailOptions = {
    from: `"Le Marché de Félix" <${smtpUser}>`,
    to: to,
    subject: `[TEST] ${subject}`,
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
