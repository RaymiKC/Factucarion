import { Router } from 'express';
import { config } from '../config';
import { getAdapter } from '../db';
import type { DatabaseAdapter, Row } from '../db/types';
import { ApiError, asyncHandler } from '../http/errors';
import { requireAuth } from '../http/auth-middleware';
import { signChangeToken, signToken, verifyChangeToken } from '../security/jwt';
import { generateOtp, hashPassword, verifyPassword } from '../security/password';
import { sendMail } from '../services/mailer';
import { prepareRow } from './row-hooks';

export const authRouter = Router();

const USER_COLUMNS = [
  'id',
  'company_id',
  'name',
  'email',
  'role',
  'is_active',
  'password_hash',
  'temp_password',
  'must_change_password',
  'otp_enabled',
  'failed_login_attempts',
  'locked_until',
  'preferred_theme',
  'preferred_language',
  'preferred_region',
  'email_language',
  'last_login',
];

interface UserRow extends Row {
  id: string;
  company_id: string | null;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  password_hash?: string | null;
  temp_password?: string | null;
  must_change_password?: boolean | null;
  otp_enabled?: boolean | null;
  failed_login_attempts?: number | null;
  locked_until?: string | Date | null;
  preferred_theme?: string | null;
  preferred_language?: string | null;
  preferred_region?: string | null;
  email_language?: string | null;
}

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedCompanyIds: string[];
  preferredTheme: string;
  preferredLanguage: string;
  preferredRegion: string;
  mustChangePassword: boolean;
  otpEnabled: boolean;
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase().trim() : '';
}

async function findUserByEmail(db: DatabaseAdapter, email: string): Promise<UserRow | null> {
  if (!email) return null;
  const rows = await db.select('users_config', {
    columns: USER_COLUMNS,
    filters: [{ column: 'email', op: 'eq', value: email }],
    limit: 1,
  });
  return (rows[0] as UserRow) ?? null;
}

async function findUserById(db: DatabaseAdapter, id: string): Promise<UserRow | null> {
  const rows = await db.select('users_config', {
    columns: USER_COLUMNS,
    filters: [{ column: 'id', op: 'eq', value: id }],
    limit: 1,
  });
  return (rows[0] as UserRow) ?? null;
}

async function buildAuthUser(db: DatabaseAdapter, row: UserRow): Promise<AuthUser> {
  let assignedCompanyIds: string[] = [];
  if (row.role !== 'admin') {
    const assignments = await db.select('company_users', {
      columns: ['company_id'],
      filters: [{ column: 'user_config_id', op: 'eq', value: row.id }],
    });
    assignedCompanyIds = assignments
      .map(assignment => assignment.company_id)
      .filter((value): value is string => typeof value === 'string');
  } else if (row.company_id) {
    assignedCompanyIds = [row.company_id];
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    assignedCompanyIds,
    preferredTheme: row.preferred_theme ?? 'light',
    preferredLanguage: row.preferred_language ?? 'es',
    preferredRegion: row.preferred_region ?? 'DO',
    mustChangePassword: Boolean(row.must_change_password),
    otpEnabled: Boolean(row.otp_enabled),
  };
}

async function issueSession(db: DatabaseAdapter, row: UserRow) {
  const user = await buildAuthUser(db, row);
  const token = signToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: row.company_id ?? null,
    companyIds: user.assignedCompanyIds,
  });
  return { status: 'authenticated' as const, token, user };
}

async function isGlobalOtpRequired(db: DatabaseAdapter): Promise<boolean> {
  const rows = await db.select('feature_flags', {
    columns: ['is_enabled'],
    filters: [
      { column: 'name', op: 'eq', value: 'otp_required_for_all' },
      { column: 'is_enabled', op: 'eq', value: true },
    ],
    limit: 1,
  });
  return rows.length > 0 && Boolean(rows[0].is_enabled);
}

async function createOtp(
  db: DatabaseAdapter,
  user: { id: string; email: string },
): Promise<{ id: string; token: string }> {
  await db.update(
    'otp_tokens',
    { used: true },
    [
      { column: 'user_id', op: 'eq', value: user.id },
      { column: 'used', op: 'eq', value: false },
    ],
  );

  const token = generateOtp();
  const expiresAt = new Date(Date.now() + config.otpTtlMinutes * 60 * 1000);
  const rows = await db.insert('otp_tokens', [
    {
      user_id: user.id,
      email: user.email.toLowerCase(),
      token,
      expires_at: expiresAt,
    },
  ]);

  return { id: String(rows[0]?.id ?? ''), token };
}

function otpEmailBody(name: string, token: string, purpose: 'login' | 'reset'): { subject: string; text: string } {
  const minutes = config.otpTtlMinutes;
  if (purpose === 'reset') {
    return {
      subject: 'FacturaPro - Codigo para restablecer contrasena',
      text: `Hola ${name},\n\nTu codigo para restablecer la contrasena es:\n\n${token}\n\nEste codigo expira en ${minutes} minutos.\n\nSi no solicitaste esto, ignora este mensaje.`,
    };
  }
  return {
    subject: 'FacturaPro - Codigo de verificacion',
    text: `Hola ${name},\n\nTu codigo de verificacion es:\n\n${token}\n\nEste codigo expira en ${minutes} minutos.`,
  };
}

async function deliverOtp(
  user: UserRow,
  otp: { id: string; token: string },
  purpose: 'login' | 'reset',
): Promise<Record<string, unknown>> {
  const message = otpEmailBody(user.name, otp.token, purpose);
  const result = await sendMail({
    to: user.email,
    subject: message.subject,
    text: message.text,
  });

  return {
    otpId: otp.id,
    delivered: result.sent,
    ...(config.otpDebug ? { devToken: otp.token } : {}),
  };
}

// ── POST /api/auth/login ────────────────────────────────────────────────────
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const db = await getAdapter();
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) throw ApiError.badRequest('Email and password are required');

    const user = await findUserByEmail(db, email);
    if (!user) throw new ApiError('Usuario o contrasena incorrectos', 401, 'invalid_credentials');

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const unlock = new Date(user.locked_until).toLocaleString('es-DO');
      throw new ApiError(`Cuenta bloqueada hasta las ${unlock}`, 423, 'account_locked');
    }

    if (!user.is_active) {
      throw new ApiError('Cuenta inactiva. Contacta al administrador.', 403, 'account_inactive');
    }

    const storedHash = user.password_hash ?? '';
    const tempHash = user.temp_password ?? '';

    const isTempLogin = Boolean(tempHash) && (await verifyPassword(password, tempHash));
    const passwordOk = isTempLogin || (await verifyPassword(password, storedHash));

    if (!passwordOk) {
      const attempts = (user.failed_login_attempts ?? 0) + 1;
      if (attempts >= config.maxLoginAttempts) {
        const lockedUntil = new Date(Date.now() + config.lockoutHours * 60 * 60 * 1000);
        await db.update(
          'users_config',
          { failed_login_attempts: 0, locked_until: lockedUntil },
          [{ column: 'id', op: 'eq', value: user.id }],
        );
        throw new ApiError(
          `Demasiados intentos fallidos. Cuenta bloqueada por ${config.lockoutHours} horas.`,
          423,
          'account_locked',
        );
      }

      await db.update(
        'users_config',
        { failed_login_attempts: attempts },
        [{ column: 'id', op: 'eq', value: user.id }],
      );
      const remaining = config.maxLoginAttempts - attempts;
      throw new ApiError(
        `Contrasena incorrecta. ${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.`,
        401,
        'invalid_credentials',
      );
    }

    // Upgrade legacy SHA-256 hashes to bcrypt on successful login.
    const upgrade: Row = {
      failed_login_attempts: 0,
      locked_until: null,
      last_login: new Date(),
    };
    if (storedHash && !storedHash.startsWith('$2')) {
      upgrade.password_hash = await hashPassword(password);
    }
    await db.update('users_config', upgrade, [{ column: 'id', op: 'eq', value: user.id }]);

    if (isTempLogin || user.must_change_password) {
      res.json({
        status: 'password_change_required',
        changeToken: signChangeToken(user.id, 'password_change'),
        userId: user.id,
      });
      return;
    }

    const needsOtp = (await isGlobalOtpRequired(db)) || Boolean(user.otp_enabled);
    if (needsOtp) {
      const otp = await createOtp(db, user);
      res.json({ status: 'otp_required', userId: user.id, ...(await deliverOtp(user, otp, 'login')) });
      return;
    }

    res.json(await issueSession(db, user));
  }),
);

// ── POST /api/auth/otp/request ─────────────────────────────────────────────
authRouter.post(
  '/otp/request',
  asyncHandler(async (req, res) => {
    const db = await getAdapter();
    const email = normalizeEmail(req.body?.email);
    const purpose = req.body?.purpose === 'login' ? 'login' : 'reset';
    if (!email) throw ApiError.badRequest('Email is required');

    const user = await findUserByEmail(db, email);
    if (!user || !user.is_active) {
      // Never reveal whether the account exists.
      res.json({ status: 'sent', delivered: false });
      return;
    }

    const otp = await createOtp(db, user);
    res.json({ status: 'sent', ...(await deliverOtp(user, otp, purpose)) });
  }),
);

// ── POST /api/auth/otp/verify ──────────────────────────────────────────────
authRouter.post(
  '/otp/verify',
  asyncHandler(async (req, res) => {
    const db = await getAdapter();
    const otpId = typeof req.body?.otpId === 'string' ? req.body.otpId : '';
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const purpose = req.body?.purpose === 'reset' ? 'reset' : 'login';

    if (!otpId || !token) throw ApiError.badRequest('otpId and token are required');

    const rows = await db.select('otp_tokens', {
      filters: [{ column: 'id', op: 'eq', value: otpId }],
      limit: 1,
    });
    const otp = rows[0];
    if (!otp) throw ApiError.badRequest('Codigo invalido');
    if (otp.used) throw ApiError.badRequest('Este codigo ya fue utilizado');
    if (new Date(otp.expires_at as string) < new Date()) {
      throw ApiError.badRequest('El codigo ha expirado. Solicita uno nuevo.');
    }
    if (Number(otp.attempts ?? 0) >= 3) {
      throw ApiError.badRequest('Demasiados intentos. Solicita un nuevo codigo.');
    }

    if (String(otp.token) !== token) {
      const attempts = Number(otp.attempts ?? 0) + 1;
      await db.update('otp_tokens', { attempts }, [{ column: 'id', op: 'eq', value: otpId }]);
      if (attempts >= 3) {
        await db.update('users_config', { is_active: false }, [
          { column: 'id', op: 'eq', value: String(otp.user_id) },
        ]);
        throw ApiError.badRequest(
          'Demasiados intentos incorrectos. Cuenta desactivada. Contacta al administrador.',
        );
      }
      const remaining = 3 - attempts;
      throw ApiError.badRequest(
        `Codigo incorrecto. ${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.`,
      );
    }

    await db.update('otp_tokens', { used: true }, [{ column: 'id', op: 'eq', value: otpId }]);

    const user = await findUserById(db, String(otp.user_id));
    if (!user) throw ApiError.notFound('Usuario no encontrado');

    if (purpose === 'reset') {
      res.json({
        status: 'password_change_required',
        changeToken: signChangeToken(user.id, 'password_reset'),
        userId: user.id,
      });
      return;
    }

    await db.update('users_config', { last_login: new Date() }, [
      { column: 'id', op: 'eq', value: user.id },
    ]);
    res.json(await issueSession(db, user));
  }),
);

// ── POST /api/auth/password ────────────────────────────────────────────────
authRouter.post(
  '/password',
  asyncHandler(async (req, res) => {
    const header = req.headers.authorization ?? '';
    const [, rawToken] = header.split(' ');
    const change = rawToken ? verifyChangeToken(rawToken.trim()) : null;
    if (!change) throw ApiError.unauthorized('A valid password change token is required');

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const confirm = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : password;

    if (password.length < 8) {
      throw ApiError.badRequest('La contrasena debe tener al menos 8 caracteres');
    }
    if (password !== confirm) {
      throw ApiError.badRequest('Las contrasenas no coinciden');
    }

    const db = await getAdapter();
    const user = await findUserById(db, change.sub);
    if (!user) throw ApiError.notFound('Usuario no encontrado');

    const prepared = await prepareRow('users_config', {
      password,
      must_change_password: false,
      temp_password: null,
      failed_login_attempts: 0,
      locked_until: null,
      updated_at: new Date(),
    });

    await db.update('users_config', prepared, [{ column: 'id', op: 'eq', value: user.id }]);

    const refreshed = await findUserById(db, user.id);
    res.json(await issueSession(db, refreshed ?? user));
  }),
);

// ── GET /api/auth/me ───────────────────────────────────────────────────────
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getAdapter();
    const user = await findUserById(db, req.auth!.sub);
    if (!user || !user.is_active) throw ApiError.unauthorized('Session is no longer valid');
    res.json({ user: await buildAuthUser(db, user), token: null });
  }),
);

// ── POST /api/auth/logout ──────────────────────────────────────────────────
authRouter.post('/logout', (_req, res) => {
  // Tokens are stateless: the client discards them.
  res.json({ status: 'signed_out' });
});

// ── PATCH /api/auth/preferences ────────────────────────────────────────────
authRouter.patch(
  '/preferences',
  requireAuth,
  asyncHandler(async (req, res) => {
    const db = await getAdapter();
    const values: Row = { updated_at: new Date() };

    if (req.body?.theme) values.preferred_theme = String(req.body.theme);
    if (req.body?.language) values.preferred_language = String(req.body.language);
    if (req.body?.region) values.preferred_region = String(req.body.region);

    if (Object.keys(values).length === 1) {
      throw ApiError.badRequest('Nothing to update');
    }

    const rows = await db.update('users_config', values, [
      { column: 'id', op: 'eq', value: req.auth!.sub },
    ]);
    const user = rows[0] as UserRow | undefined;
    if (!user) throw ApiError.notFound('Usuario no encontrado');

    res.json({ user: await buildAuthUser(db, user) });
  }),
);
