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
 * Envoie un email personnalisé à un exposant individuel.
 */
export async function sendCustomIndividualEmail(exhibitor: any, subject: string, body: string, includeDossierLink: boolean, marketConfig: any) {
  const transporter = createTransporter(marketConfig);
  const baseUrl = await getBaseUrl();
  const detailsLink = `${baseUrl}/details/${exhibitor.id}`;
  const smtpUser = (marketConfig?.smtpUser || process.env.SMTP_USER || "").trim();

  const mailOptions = {
    from: `"Le Marché de Félix" <${smtpUser}>`,
    to: exhibitor.email,
    subject: subject,
    text: body.replace(/<[^>]*>?/gm, ''),
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #2E3192; padding: 25px; text-align: center;">
          <h2 style="color: white; margin: 0;">Message de l'organisateur</h2>
        </div>
        <div style="padding: 30px; line-height: 1.6;">
          <p>Bonjour ${exhibitor.firstName} ${exhibitor.lastName},</p>
          <div style="margin: 20px 0;">
            ${body}
          </div>
          
          ${includeDossierLink ? `
            <div style="text-align: center; margin: 35px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
              <p style="margin-bottom: 15px; font-weight: bold;">Accès à votre dossier technique :</p>
              <a href="${detailsLink}" style="background-color: #2E3192; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Compléter mon dossier</a>
              <p style="font-size: 11px; color: #888; margin-top: 15px;">Lien direct : <a href="${detailsLink}" style="color: #2E3192;">${detailsLink}</a></p>
            </div>
          ` : ''}
          
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="margin: 0;">L'équipe "Un jardin pour Félix"</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error: any) {
    console.error('SMTP Error (Individual Custom):', error);
    return { success: false, error: error.message };
  }
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
    text: `Bonjour ${exhibitor.firstName} ${exhibitor.lastName}, Nous avons le plaisir de vous informer que votre candidature pour le Marché de Noël ${year} a été acceptée. Complétez votre dossier ici : ${detailsLink}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #2E3192; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Félicitations !</h1>
        </div>
        <div style="padding: 30px; line-height: 1.6;">
          <p style="font-size: 16px;">Bonjour <strong>${exhibitor.firstName} ${exhibitor.lastName}</strong>,</p>
          <p>Nous avons le plaisir de vous informer que votre candidature pour le <strong>Marché de Noël ${year}</strong> a été acceptée par notre comité.</p>
          
          ${customMessage ? `
            <div style="background-color: #f8f9fa; border-left: 4px solid #2E3192; padding: 20px; margin: 25px 0; font-style: italic;">
              <strong style="color: #2E3192; display: block; margin-bottom: 5px; font-style: normal;">Note de l'organisateur :</strong>
              ${customMessage.replace(/\n/g, '<br/>')}
            </div>
          ` : ''}
          
          <p>Pour confirmer votre emplacement, merci de finaliser votre <strong>dossier technique</strong> en cliquant sur le bouton ci-dessous :</p>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${detailsLink}" style="background-color: #2E3192; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Compléter mon dossier technique</a>
          </div>
          
          <p style="font-size: 12px; color: #888; text-align: center; margin-top: 40px;">
            Si le bouton ne s'affiche pas correctement, copiez ce lien :<br/>
            <a href="${detailsLink}" style="color: #2E3192;">${detailsLink}</a>
          </p>
          
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
          
          <p style="margin: 0; font-weight: bold;">À bientôt !</p>
          <p style="margin: 0;">L'équipe "Un jardin pour Félix"</p>
        </div>
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 11px; color: #999;">
          Association "Un jardin pour Félix" - Chazay d'Azergues
        </div>
      </div>
    `,
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
    text: `Bonjour ${exhibitor.firstName} ${exhibitor.lastName}, Nous sommes au regret de vous indiquer que votre candidature n'a pas été retenue pour l'édition ${year}. Motif : ${justification}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #f1f1f1; padding: 20px; text-align: center; border-bottom: 2px solid #ddd;">
          <h2 style="margin: 0; color: #555;">Information Candidature</h2>
        </div>
        <div style="padding: 30px; line-height: 1.6;">
          <p>Bonjour ${exhibitor.firstName} ${exhibitor.lastName},</p>
          <p>Nous vous remercions de l'intérêt que vous portez à notre événement.</p>
          <p>Toutefois, nous sommes au regret de vous indiquer que votre candidature n'a pas été retenue par notre comité pour l'édition <strong>${year}</strong>.</p>
          
          <div style="background-color: #fff5f5; border-left: 4px solid #f56565; padding: 20px; margin: 25px 0;">
            <strong style="color: #c53030; display: block; margin-bottom: 5px;">Motif de la décision :</strong>
            ${justification.replace(/\n/g, '<br/>')}
          </div>
          
          <p>Nous vous souhaitons une excellente continuation dans vos projets artisanaux.</p>
          <p>Merci pour votre compréhension.<br/>L'équipe "Un jardin pour Félix"</p>
        </div>
      </div>
    `
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

  const mailOptions = {
    from: `"Le Marché de Félix" <${smtpUser}>`,
    to: exhibitor.email,
    subject: `Confirmation dossier - ${exhibitor.companyName}`,
    text: `Bonjour ${exhibitor.firstName} ${exhibitor.lastName}, Nous avons bien reçu votre dossier technique. Total à régler : ${total} EUR.`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #2E3192; padding: 25px; text-align: center;">
          <h2 style="color: white; margin: 0;">Dossier reçu !</h2>
        </div>
        <div style="padding: 30px; line-height: 1.6;">
          <p>Bonjour ${exhibitor.firstName} ${exhibitor.lastName},</p>
          <p>Nous avons bien reçu votre dossier technique pour le <strong>Marché de Noël ${year}</strong>.</p>
          
          <div style="background-color: #f0f4f8; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #2E3192; border-bottom: 1px solid #d0dbe5; padding-bottom: 10px;">Récapitulatif financier</h3>
            <table style="width: 100%; font-size: 14px;">
              <tr><td>Emplacement (${exhibitor.requestedTables} table(s))</td><td style="text-align: right;">${standPrice} €</td></tr>
              ${electricityPrice > 0 ? `<tr><td>Option Électricité</td><td style="text-align: right;">${electricityPrice} €</td></tr>` : ''}
              ${mealsPrice > 0 ? `<tr><td>Plateaux repas (${details.sundayLunchCount})</td><td style="text-align: right;">${mealsPrice} €</td></tr>` : ''}
              <tr style="font-weight: bold; font-size: 18px; color: #2E3192;"><td style="padding-top: 15px;">TOTAL À RÉGLER</td><td style="padding-top: 15px; text-align: right;">${total} €</td></tr>
            </table>
          </div>
          
          <div style="background-color: #fffaf0; border: 1px dashed #ed8936; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <p style="margin: 0; font-size: 14px;">
              <strong>Règlement par chèque :</strong><br/>
              Merci d'envoyer votre chèque libellé à l'ordre de <strong>"Les amis d'un Jardin pour Félix"</strong> à l'adresse :<br/>
              <em>30 rue du Colombier 69380 CHAZAY D'AZERGUES</em>.
            </p>
            <p style="font-size: 12px; color: #666; margin-top: 10px;">
              Le chèque doit nous parvenir sous 15 jours. Il sera encaissé environ 15 jours avant l'événement.
            </p>
          </div>

          <p style="font-size: 14px;">
            <strong>Rappel :</strong> Rendez-vous le <strong>samedi ${satDate}</strong> dès ${satHours} et le <strong>dimanche ${sunDate}</strong> à partir de ${sunHours} à la salle Maurice Baquet.
          </p>
          
          <p>À bientôt !<br/>L'équipe "Un jardin pour Félix"</p>
        </div>
      </div>
    `
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
 * Envoie l'email de test.
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