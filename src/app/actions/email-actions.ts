
'use server';

import nodemailer from 'nodemailer';
import { headers } from 'next/headers';

/**
 * Récupère la base URL de manière dynamique et robuste pour la production.
 */
async function getBaseUrl() {
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'localhost:9002';
  const proto = headersList.get('x-forwarded-proto')?.split(',')[0] || (host.includes('localhost') ? 'http' : 'https');
  
  return `${proto}://${host}`;
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
    text: `Bonjour, Une nouvelle candidature vient d'être déposée pour le Marché de Noël ${year}.`
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
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

  const baseUrl = await getBaseUrl();
  const detailsLink = `${baseUrl}/details/${exhibitor.id}`;
  const year = marketConfig?.marketYear || '2026';

  const mailOptions = {
    from: `"Le Marché de Félix" <${process.env.EMAIL_USER}>`,
    to: exhibitor.email,
    subject: `Votre candidature pour le Marché de Félix ${year} a été retenue !`,
    text: `Bonjour, votre candidature a été acceptée. Finalisez votre dossier ici : ${detailsLink}`
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to send acceptance email' };
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

  const mailOptions = {
    from: `"Le Marché de Félix" <${process.env.EMAIL_USER}>`,
    to: exhibitor.email,
    subject: `Votre candidature pour le Marché de Noël`,
    text: `Désolé, votre candidature n'a pas été retenue. Motif : ${justification}`
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to send rejection email' };
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

  const mailOptions = {
    from: `"Le Marché de Félix" <${process.env.EMAIL_USER}>`,
    to: exhibitor.email,
    subject: `Confirmation de réception de votre dossier technique`,
    text: `Nous avons bien reçu votre dossier technique.`
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to send final confirmation email' };
  }
}
