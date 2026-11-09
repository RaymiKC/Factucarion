import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailResult {
  sent: boolean;
  reason?: string;
}

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = null;
    return transporter;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass: password ?? '' } : undefined,
    tls: { rejectUnauthorized: false },
  });
  return transporter;
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const client = getTransporter();
  if (!client) {
    console.warn(`[mail] SMTP not configured, skipping message "${message.subject}" to ${message.to}`);
    return { sent: false, reason: 'SMTP is not configured' };
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'no-reply@facturpro.local';

  try {
    await client.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { sent: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error('[mail] send failed', reason);
    return { sent: false, reason };
  }
}
