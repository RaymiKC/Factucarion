/*
  Thin wrapper around the FacturaPro auth endpoints.
  All credential checks, lockout and OTP handling happen in the API
  (server/src/routes/auth.ts) - the browser only holds the JWT.
*/

import { API_BASE, apiRequest, getAuthToken, setAuthToken } from './db';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  assignedCompanyIds: string[];
  preferredTheme: string;
  preferredLanguage: string;
  preferredRegion: string;
  mustChangePassword?: boolean;
  otpEnabled?: boolean;
}

export type LoginStep = 'credentials' | 'otp' | 'set_password';

export interface LoginResult {
  success: boolean;
  error?: string;
  step?: LoginStep;
  userId?: string;
  otpId?: string;
  changeToken?: string;
  devToken?: string;
}

interface SessionPayload {
  status?: string;
  token?: string;
  user?: AuthUser;
  otpId?: string;
  userId?: string;
  changeToken?: string;
  devToken?: string;
  delivered?: boolean;
  error?: string;
}

export interface OtpRequestResult {
  success: boolean;
  error?: string;
  otpId?: string;
  devToken?: string;
}

export interface OtpVerifyResult {
  success: boolean;
  error?: string;
  changeToken?: string;
  user?: AuthUser;
}

const CHANGE_TOKEN_KEY = 'facturapro_change_token';

export function storeChangeToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(CHANGE_TOKEN_KEY, token);
    else sessionStorage.removeItem(CHANGE_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function readChangeToken(): string | null {
  try {
    return sessionStorage.getItem(CHANGE_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function post<T>(path: string, body: unknown, token?: string | null): Promise<{ data: T | null; error: string | null }> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  }).catch(() => null);

  if (!response) return { data: null, error: 'No se pudo conectar con el servidor' };

  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    return { data: null, error: payload?.error ?? `Error ${response.status}` };
  }
  return { data: payload as T, error: null };
}

export const authApi = {
  async login(email: string, password: string): Promise<{ result: LoginResult; user?: AuthUser }> {
    const { data, error } = await post<SessionPayload>('/api/auth/login', { email, password });
    if (error || !data) return { result: { success: false, error: error ?? 'Error de autenticación' } };

    if (data.status === 'authenticated' && data.token && data.user) {
      setAuthToken(data.token);
      return { result: { success: true }, user: data.user };
    }

    if (data.status === 'otp_required') {
      return {
        result: {
          success: false,
          step: 'otp',
          userId: data.userId,
          otpId: data.otpId,
          devToken: data.devToken,
        },
      };
    }

    if (data.status === 'password_change_required') {
      storeChangeToken(data.changeToken ?? null);
      return {
        result: { success: false, step: 'set_password', userId: data.userId },
      };
    }

    return { result: { success: false, error: 'Respuesta inesperada del servidor' } };
  },

  async requestOtp(email: string, purpose: 'reset' | 'login'): Promise<OtpRequestResult> {
    const { data, error } = await post<SessionPayload>('/api/auth/otp/request', { email, purpose });
    if (error || !data) return { success: false, error: error ?? 'Error al enviar el código' };
    return { success: true, otpId: data.otpId, devToken: data.devToken };
  },

  async verifyOtp(otpId: string, token: string, purpose: 'reset' | 'login'): Promise<OtpVerifyResult> {
    const { data, error } = await post<SessionPayload>('/api/auth/otp/verify', { otpId, token, purpose });
    if (error || !data) return { success: false, error: error ?? 'Código inválido' };

    if (data.status === 'authenticated' && data.token && data.user) {
      setAuthToken(data.token);
      return { success: true, user: data.user };
    }

    if (data.status === 'password_change_required') {
      storeChangeToken(data.changeToken ?? null);
      return { success: true };
    }

    return { success: true };
  },

  async changePassword(password: string, confirmPassword: string): Promise<{ success: boolean; error?: string; user?: AuthUser }> {
    const changeToken = readChangeToken();
    if (!changeToken) return { success: false, error: 'La sesión de cambio de contraseña expiró' };

    const { data, error } = await post<SessionPayload>('/api/auth/password', { password, confirmPassword }, changeToken);
    if (error || !data) return { success: false, error: error ?? 'No se pudo actualizar la contraseña' };

    storeChangeToken(null);
    if (data.token && data.user) {
      setAuthToken(data.token);
      return { success: true, user: data.user };
    }
    return { success: true };
  },

  async me(): Promise<AuthUser | null> {
    if (!getAuthToken()) return null;
    const { data, error } = await apiRequest<{ user: AuthUser }>('/api/auth/me', { method: 'GET' });
    if (error || !data) return null;
    return data.user;
  },

  async updatePreferences(prefs: { theme?: string; language?: string; region?: string }): Promise<AuthUser | null> {
    const { data, error } = await apiRequest<{ user: AuthUser }>('/api/auth/preferences', {
      method: 'PATCH',
      body: prefs,
    });
    if (error || !data) return null;
    return data.user;
  },

  async logout(): Promise<void> {
    await apiRequest('/api/auth/logout', { body: {} });
    setAuthToken(null);
    storeChangeToken(null);
  },
};

export const mailApi = {
  async send(message: { to: string; subject: string; body: string; variables?: Record<string, unknown> }): Promise<{
    data: { sent?: boolean; reason?: string; preview?: Record<string, unknown> } | null;
    error: { message: string } | null;
  }> {
    return apiRequest('/api/mail/send', { body: message });
  },
};
