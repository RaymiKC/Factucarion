import { Router } from 'express';
import { config } from '../config';
import { ApiError, asyncHandler } from '../http/errors';
import { requireAuth } from '../http/auth-middleware';
import { isMailConfigured, sendMail } from '../services/mailer';

export const mailRouter = Router();

/** Replaces the old Supabase send-email edge function. */
mailRouter.post(
  '/send',
  requireAuth,
  asyncHandler(async (req, res) => {
    const to = typeof req.body?.to === 'string' ? req.body.to.trim() : '';
    const subject = typeof req.body?.subject === 'string' ? req.body.subject : '';
    const body = typeof req.body?.body === 'string' ? req.body.body : '';
    const html = typeof req.body?.html === 'string' ? req.body.html : undefined;
    const variables = req.body?.variables as Record<string, unknown> | undefined;

    if (!to || !subject) throw ApiError.badRequest('"to" and "subject" are required');

    const text = variables
      ? Object.entries(variables).reduce(
          (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value ?? '')),
          body,
        )
      : body;

    if (!isMailConfigured()) {
      res.status(202).json({
        sent: false,
        reason: 'SMTP is not configured on the API server',
        preview: { to, subject, text },
      });
      return;
    }

    const result = await sendMail({ to, subject, text, html });
    res.status(result.sent ? 200 : 502).json(result);
  }),
);

mailRouter.get('/status', (_req, res) => {
  res.json({
    configured: isMailConfigured(),
    host: process.env.SMTP_HOST ? '***' : null,
    from: process.env.SMTP_FROM ?? null,
    debugMode: config.otpDebug,
  });
});
