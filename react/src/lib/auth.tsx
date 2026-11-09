import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, mailApi, readChangeToken, type AuthUser, type LoginResult } from './auth-api';
import type { AppTheme } from './theme';

export type { AuthUser, LoginResult };
export type LoginStep = 'credentials' | 'otp' | 'set_password';

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  updatePreferences: (prefs: { theme?: AppTheme; language?: string; region?: string }) => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  canAccessCompany: (companyId: string) => boolean;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string; otpId?: string; devToken?: string }>;
  verifyOtp: (otpId: string, token: string) => Promise<{ success: boolean; error?: string; userId?: string }>;
  setNewPassword: (userId: string, password: string, confirmPassword: string) => Promise<{ success: boolean; error?: string }>;
  completeOtpLogin: (userId: string) => Promise<LoginResult>;
  pendingOtpPurpose: 'reset' | 'login';
  setPendingOtpPurpose: (purpose: 'reset' | 'login') => void;
}

const USER_KEY = 'facturapro_user';

const DEMO_USER: AuthUser = {
  id: 'demo',
  name: 'Demo',
  email: 'demo',
  role: 'admin',
  assignedCompanyIds: [],
  preferredTheme: 'light',
  preferredLanguage: 'es',
  preferredRegion: 'DO',
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  try {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  } catch {
    return null;
  }
}

function persistUser(user: AuthUser | null) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);
  const [pendingOtpPurpose, setPendingOtpPurpose] = useState<'reset' | 'login'>('reset');
  const [lastVerifiedUserId, setLastVerifiedUserId] = useState<string | null>(null);

  const applyUser = useCallback((next: AuthUser | null) => {
    setUser(next);
    persistUser(next);
  }, []);

  // Restore the session from the stored JWT on first load.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = readStoredUser();
      if (stored?.id === 'demo') {
        if (!cancelled) setUser(stored);
        return;
      }

      const profile = await authApi.me();
      if (cancelled) return;

      if (profile) applyUser(profile);
      else applyUser(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [applyUser]);

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const identifier = email.toLowerCase().trim();

    if ((identifier === 'demo' || identifier === 'demo@demo.com') && password === 'demo') {
      applyUser(DEMO_USER);
      return { success: true };
    }

    const { result, user: profile } = await authApi.login(identifier, password);

    if (result.success && profile) {
      applyUser(profile);
      return { success: true };
    }

    return result;
  }, [applyUser]);

  const completeOtpLogin = useCallback(async (_userId: string): Promise<LoginResult> => {
    const profile = await authApi.me();
    if (!profile) return { success: false, error: 'No se pudo completar la sesión' };
    applyUser(profile);
    return { success: true };
  }, [applyUser]);

  // ── PASSWORD RESET ────────────────────────────────────────────────────────
  const requestPasswordReset = useCallback(async (email: string) => {
    const response = await authApi.requestOtp(email.toLowerCase().trim(), 'reset');
    return response;
  }, []);

  const verifyOtp = useCallback(async (otpId: string, token: string) => {
    const response = await authApi.verifyOtp(otpId, token, pendingOtpPurpose);
    if (!response.success) return { success: false, error: response.error };

    if (response.user) {
      applyUser(response.user);
      setLastVerifiedUserId(response.user.id);
      return { success: true, userId: response.user.id };
    }

    if (!readChangeToken()) {
      return { success: false, error: 'No se pudo iniciar el cambio de contraseña' };
    }
    return { success: true, userId: lastVerifiedUserId ?? undefined };
  }, [pendingOtpPurpose, applyUser, lastVerifiedUserId]);

  const setNewPassword = useCallback(async (
    _userId: string,
    password: string,
    confirmPassword: string,
  ) => {
    const response = await authApi.changePassword(password, confirmPassword);
    if (!response.success) return { success: false, error: response.error };
    if (response.user) applyUser(response.user);
    return { success: true };
  }, [applyUser]);

  const logout = useCallback(async () => {
    await authApi.logout();
    applyUser(null);
  }, [applyUser]);

  const updatePreferences = useCallback(async (prefs: { theme?: AppTheme; language?: string; region?: string }) => {
    if (!user) return;
    const updated = await authApi.updatePreferences(prefs);
    if (updated) applyUser(updated);
  }, [user, applyUser]);

  const isAdmin = user?.role === 'admin';

  const canAccessCompany = useCallback((companyId: string) => {
    if (!user) return false;
    if (user.role === 'admin' || user.id === 'demo') return true;
    return user.assignedCompanyIds.includes(companyId);
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      updatePreferences,
      isAuthenticated: !!user,
      isAdmin,
      canAccessCompany,
      requestPasswordReset,
      verifyOtp,
      setNewPassword,
      completeOtpLogin,
      pendingOtpPurpose,
      setPendingOtpPurpose,
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

export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 15; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Standalone welcome email sender — usable outside the auth context (e.g. Admin.tsx)
export async function sendWelcomeEmail(
  email: string, name: string, tempPassword: string, lang = 'es',
): Promise<void> {
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

  const template = templates[lang] ?? templates['es'];
  await mailApi.send({
    to: email,
    subject: template.subject,
    body: template.body,
    variables: { token: tempPassword },
  });
}
