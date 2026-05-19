import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { AppTheme } from './theme';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedCompanyIds: string[];
  preferredTheme: AppTheme;
  preferredLanguage: string;
  preferredRegion: string;
  mustChangePassword?: boolean;
  otpEnabled?: boolean;
}

export type LoginStep =
  | 'credentials'
  | 'otp'           // enter 6-digit OTP after login (when otp_enabled)
  | 'set_password'; // new user / after OTP reset → set new password

export interface LoginResult {
  success: boolean;
  error?: string;
  step?: LoginStep;
  userId?: string;
  otpId?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  updatePreferences: (prefs: { theme?: AppTheme; language?: string; region?: string }) => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  canAccessCompany: (companyId: string) => boolean;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string; otpId?: string }>;
  verifyOtp: (otpId: string, token: string) => Promise<{ success: boolean; error?: string; userId?: string }>;
  setNewPassword: (userId: string, password: string, confirmPassword: string) => Promise<{ success: boolean; error?: string }>;
  completeOtpLogin: (userId: string) => Promise<LoginResult>;
}

const USER_KEY = 'facturapro_user';
const LOCKOUT_HOURS = 24;
const MAX_LOGIN_ATTEMPTS = 3;
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 3;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      loadProfileBySupabaseUid(session.user.id).then(profile => {
        if (profile) {
          setUser(profile);
          localStorage.setItem(USER_KEY, JSON.stringify(profile));
        }
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          localStorage.removeItem(USER_KEY);
          return;
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const profile = await loadProfileBySupabaseUid(session.user.id);
          if (profile) {
            setUser(profile);
            localStorage.setItem(USER_KEY, JSON.stringify(profile));
          }
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfileBySupabaseUid(uid: string): Promise<AuthUser | null> {
    const { data } = await supabase
      .from('users_config')
      .select('id, name, email, role, is_active, preferred_theme, preferred_language, preferred_region, must_change_password, otp_enabled')
      .eq('supabase_uid', uid)
      .eq('is_active', true)
      .maybeSingle();
    if (!data) return null;
    return buildAuthUser(data);
  }

  async function loadProfileByEmail(email: string) {
    const { data } = await supabase
      .from('users_config')
      .select('id, name, email, role, is_active, auth_provider, password_hash, preferred_theme, preferred_language, preferred_region, must_change_password, otp_enabled, failed_login_attempts, locked_until, temp_password, email_language')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();
    return data ?? null;
  }

  async function buildAuthUser(data: {
    id: string; name: string; email: string; role: string; is_active: boolean;
    preferred_theme?: string | null; preferred_language?: string | null; preferred_region?: string | null;
    must_change_password?: boolean | null; otp_enabled?: boolean | null;
  }): Promise<AuthUser> {
    let assignedCompanyIds: string[] = [];
    if (data.role !== 'admin') {
      const { data: assignments } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_config_id', data.id);
      assignedCompanyIds = (assignments ?? []).map((a: { company_id: string }) => a.company_id);
    }
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role as AuthUser['role'],
      assignedCompanyIds,
      preferredTheme: (data.preferred_theme as AppTheme) ?? 'light',
      preferredLanguage: data.preferred_language ?? 'es',
      preferredRegion: data.preferred_region ?? 'DO',
      mustChangePassword: data.must_change_password ?? false,
      otpEnabled: data.otp_enabled ?? false,
    };
  }

  async function verifyPasswordHash(password: string, hash: string): Promise<boolean> {
    if (!hash) return false;
    const encoder = new TextEncoder();
    const d = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', d);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === hash;
  }

  async function isGlobalOtpRequired(): Promise<boolean> {
    const { data } = await supabase
      .from('feature_flags')
      .select('is_enabled')
      .eq('name', 'otp_required_for_all')
      .maybeSingle();
    return data?.is_enabled ?? false;
  }

  async function createOtpToken(userId: string, email: string): Promise<{ id: string; token: string }> {
    await supabase.from('otp_tokens')
      .update({ used: true })
      .eq('user_id', userId)
      .eq('used', false);

    const token = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    const { data } = await supabase.from('otp_tokens').insert({
      user_id: userId,
      email: email.toLowerCase(),
      token,
      expires_at: expiresAt,
    }).select('id').single();

    return { id: data?.id ?? '', token };
  }

  async function sendOtpEmail(
    email: string, name: string, token: string,
    purpose: 'reset' | 'login' | 'welcome',
    lang: string = 'es',
  ): Promise<void> {
    const templates: Record<string, Record<string, { subject: string; body: string }>> = {
      reset: {
        es: {
          subject: 'FacturaPro — Código para restablecer contraseña',
          body: `Hola ${name},\n\nTu código para restablecer la contraseña es:\n\n{{token}}\n\nEste código expira en ${OTP_EXPIRY_MINUTES} minutos.\n\nSi no solicitaste esto, ignora este mensaje.`,
        },
        en: {
          subject: 'FacturaPro — Password reset code',
          body: `Hi ${name},\n\nYour password reset code is:\n\n{{token}}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.\n\nIf you did not request this, please ignore this message.`,
        },
        fr: {
          subject: 'FacturaPro — Code de réinitialisation du mot de passe',
          body: `Bonjour ${name},\n\nVotre code de réinitialisation de mot de passe est :\n\n{{token}}\n\nCe code expire dans ${OTP_EXPIRY_MINUTES} minutes.\n\nSi vous n'avez pas effectué cette demande, veuillez ignorer ce message.`,
        },
      },
      login: {
        es: {
          subject: 'FacturaPro — Código de verificación',
          body: `Hola ${name},\n\nTu código de verificación es:\n\n{{token}}\n\nEste código expira en ${OTP_EXPIRY_MINUTES} minutos.`,
        },
        en: {
          subject: 'FacturaPro — Verification code',
          body: `Hi ${name},\n\nYour verification code is:\n\n{{token}}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
        },
        fr: {
          subject: 'FacturaPro — Code de vérification',
          body: `Bonjour ${name},\n\nVotre code de vérification est :\n\n{{token}}\n\nCe code expire dans ${OTP_EXPIRY_MINUTES} minutes.`,
        },
      },
      welcome: {
        es: {
          subject: 'FacturaPro — Tu cuenta ha sido creada',
          body: `Hola ${name},\n\nTu cuenta en FacturaPro ha sido creada.\n\nTu contraseña temporal es:\n\n{{token}}\n\nUsa esta contraseña para iniciar sesión. Al entrar, se te pedirá que la cambies.\n\nSi tienes preguntas, contacta a tu administrador.`,
        },
        en: {
          subject: 'FacturaPro — Your account has been created',
          body: `Hi ${name},\n\nYour FacturaPro account has been created.\n\nYour temporary password is:\n\n{{token}}\n\nUse this password to log in. You will be prompted to change it on first sign-in.\n\nIf you have questions, contact your administrator.`,
        },
        fr: {
          subject: 'FacturaPro — Votre compte a été créé',
          body: `Bonjour ${name},\n\nVotre compte FacturaPro a été créé.\n\nVotre mot de passe temporaire est :\n\n{{token}}\n\nUtilisez ce mot de passe pour vous connecter. Vous serez invité à le changer lors de votre première connexion.\n\nSi vous avez des questions, contactez votre administrateur.`,
        },
      },
    };

    const tpl = templates[purpose]?.[lang] ?? templates[purpose]?.['es'];
    if (!tpl) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
      body: JSON.stringify({ to: email, subject: tpl.subject, body: tpl.body, variables: { token } }),
    }).catch(() => {});
  }

  // ── LOGIN ───────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    if ((email.toLowerCase() === 'demo' || email.toLowerCase() === 'demo@demo.com') && password === 'demo') {
      const demoUser: AuthUser = {
        id: 'demo', name: 'Demo', email: 'demo', role: 'admin',
        assignedCompanyIds: [], preferredTheme: 'light',
        preferredLanguage: 'es', preferredRegion: 'DO',
      };
      setUser(demoUser);
      localStorage.setItem(USER_KEY, JSON.stringify(demoUser));
      return { success: true };
    }

    const profile = await loadProfileByEmail(email);

    if (!profile) {
      return { success: false, error: 'Usuario o contraseña incorrectos' };
    }

    if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
      const unlockTime = new Date(profile.locked_until).toLocaleString('es-DO');
      return { success: false, error: `Cuenta bloqueada hasta las ${unlockTime}` };
    }

    if (!profile.is_active) {
      return { success: false, error: 'Cuenta inactiva. Contacta al administrador.' };
    }

    let passwordOk = false;
    const isTempLogin = profile.temp_password && password === profile.temp_password;

    if (isTempLogin) {
      passwordOk = true;
    } else {
      const { data: authData } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });
      if (authData?.session) {
        passwordOk = true;
      } else {
        passwordOk = await verifyPasswordHash(password, profile.password_hash ?? '');
      }
    }

    if (!passwordOk) {
      const newAttempts = (profile.failed_login_attempts ?? 0) + 1;
      const updates: Record<string, unknown> = { failed_login_attempts: newAttempts };

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        updates.locked_until = new Date(Date.now() + LOCKOUT_HOURS * 60 * 60 * 1000).toISOString();
        updates.failed_login_attempts = 0;
        await supabase.from('users_config').update(updates).eq('id', profile.id);
        return { success: false, error: `Demasiados intentos fallidos. Cuenta bloqueada por ${LOCKOUT_HOURS} horas.` };
      }

      await supabase.from('users_config').update(updates).eq('id', profile.id);
      const remaining = MAX_LOGIN_ATTEMPTS - newAttempts;
      return { success: false, error: `Contraseña incorrecta. ${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.` };
    }

    await supabase.from('users_config').update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login: new Date().toISOString(),
    }).eq('id', profile.id);

    if (isTempLogin || profile.must_change_password) {
      return { success: false, step: 'set_password', userId: profile.id };
    }

    const globalOtp = await isGlobalOtpRequired();
    const needsOtp = globalOtp || profile.otp_enabled;

    if (needsOtp) {
      const { id: otpId, token } = await createOtpToken(profile.id, profile.email);
      await sendOtpEmail(profile.email, profile.name, token, 'login', profile.email_language ?? 'es');
      return { success: false, step: 'otp', userId: profile.id, otpId };
    }

    const authUser = await buildAuthUser(profile);
    setUser(authUser);
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    return { success: true };
  }, []);

  const completeOtpLogin = useCallback(async (userId: string): Promise<LoginResult> => {
    const { data: profile } = await supabase
      .from('users_config')
      .select('id, name, email, role, is_active, preferred_theme, preferred_language, preferred_region, must_change_password, otp_enabled')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) return { success: false, error: 'Usuario no encontrado' };
    const authUser = await buildAuthUser(profile);
    setUser(authUser);
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    return { success: true };
  }, []);

  // ── PASSWORD RESET ──────────────────────────────────────────────────────────
  const requestPasswordReset = useCallback(async (email: string) => {
    const profile = await loadProfileByEmail(email);
    if (!profile || !profile.is_active) {
      return { success: true }; // silent — don't reveal if email exists
    }

    const { id: otpId, token } = await createOtpToken(profile.id, profile.email);
    await sendOtpEmail(profile.email, profile.name, token, 'reset', profile.email_language ?? 'es');
    return { success: true, otpId };
  }, []);

  const verifyOtp = useCallback(async (otpId: string, token: string) => {
    const { data: otp } = await supabase
      .from('otp_tokens')
      .select('*')
      .eq('id', otpId)
      .maybeSingle();

    if (!otp) return { success: false, error: 'Código inválido' };
    if (otp.used) return { success: false, error: 'Este código ya fue utilizado' };
    if (new Date(otp.expires_at) < new Date()) return { success: false, error: 'El código ha expirado. Solicita uno nuevo.' };
    if (otp.attempts >= MAX_OTP_ATTEMPTS) return { success: false, error: 'Demasiados intentos. Solicita un nuevo código.' };

    if (otp.token !== token.trim()) {
      const newAttempts = otp.attempts + 1;
      await supabase.from('otp_tokens').update({ attempts: newAttempts }).eq('id', otpId);
      const remaining = MAX_OTP_ATTEMPTS - newAttempts;
      if (remaining <= 0) {
        await supabase.from('users_config').update({ is_active: false }).eq('id', otp.user_id);
        return { success: false, error: 'Demasiados intentos incorrectos. Cuenta desactivada. Contacta al administrador.' };
      }
      return { success: false, error: `Código incorrecto. ${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.` };
    }

    await supabase.from('otp_tokens').update({ used: true }).eq('id', otpId);
    return { success: true, userId: otp.user_id };
  }, []);

  const setNewPassword = useCallback(async (userId: string, password: string, confirmPassword: string) => {
    if (password !== confirmPassword) {
      return { success: false, error: 'Las contraseñas no coinciden' };
    }
    if (password.length < 8) {
      return { success: false, error: 'La contraseña debe tener al menos 8 caracteres' };
    }

    const hash = await hashPassword(password);
    await supabase.from('users_config').update({
      password_hash: hash,
      must_change_password: false,
      temp_password: null,
      failed_login_attempts: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    }).eq('id', userId);

    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {});
    setUser(null);
    localStorage.removeItem(USER_KEY);
  }, []);

  const updatePreferences = useCallback(async (prefs: { theme?: AppTheme; language?: string; region?: string }) => {
    if (!user) return;
    const updates: Record<string, string> = {};
    if (prefs.theme)    updates.preferred_theme    = prefs.theme;
    if (prefs.language) updates.preferred_language = prefs.language;
    if (prefs.region)   updates.preferred_region   = prefs.region;
    if (Object.keys(updates).length === 0) return;

    await supabase.from('users_config').update(updates).eq('id', user.id);

    const updated = {
      ...user,
      preferredTheme:    (prefs.theme    ?? user.preferredTheme) as AppTheme,
      preferredLanguage:  prefs.language ?? user.preferredLanguage,
      preferredRegion:    prefs.region   ?? user.preferredRegion,
    };
    setUser(updated);
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
  }, [user]);

  const isAdmin = user?.role === 'admin';

  const canAccessCompany = useCallback((companyId: string) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.assignedCompanyIds.includes(companyId);
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, login, logout, updatePreferences,
      isAuthenticated: !!user,
      isAdmin, canAccessCompany,
      requestPasswordReset, verifyOtp, setNewPassword, completeOtpLogin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 15; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Standalone welcome email sender — usable outside auth context (e.g. Admin.tsx)
export async function sendWelcomeEmail(
  email: string, name: string, tempPassword: string, lang: string = 'es',
): Promise<void> {
  const OTP_EXPIRY = 10;
  const templates: Record<string, { subject: string; body: string }> = {
    es: {
      subject: 'FacturaPro — Tu cuenta ha sido creada',
      body: `Hola ${name},\n\nTu cuenta en FacturaPro ha sido creada.\n\nTu contraseña temporal es:\n\n{{token}}\n\nUsa esta contraseña para iniciar sesión. Al entrar, se te pedirá que la cambies.\n\nSi tienes preguntas, contacta a tu administrador.`,
    },
    en: {
      subject: 'FacturaPro — Your account has been created',
      body: `Hi ${name},\n\nYour FacturaPro account has been created.\n\nYour temporary password is:\n\n{{token}}\n\nUse this password to log in. You will be prompted to change it on first sign-in.\n\nIf you have questions, contact your administrator.`,
    },
    fr: {
      subject: 'FacturaPro — Votre compte a été créé',
      body: `Bonjour ${name},\n\nVotre compte FacturaPro a été créé.\n\nVotre mot de passe temporaire est :\n\n{{token}}\n\nUtilisez ce mot de passe pour vous connecter. Vous serez invité à le changer lors de votre première connexion.\n\nSi vous avez des questions, contactez votre administrateur.`,
    },
  };

  const tpl = templates[lang] ?? templates['es'];
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
    body: JSON.stringify({
      to: email,
      subject: tpl.subject,
      body: tpl.body,
      variables: { token: tempPassword },
    }),
  }).catch(() => {});
  void OTP_EXPIRY; // suppress unused warning
}
