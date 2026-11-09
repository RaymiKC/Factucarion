import { Injectable, signal, computed } from '@angular/core';
import { apiFetch, getAuthToken, setAuthToken, DbService } from './db.service';

export interface AuthUser {
  id: string; name: string; email: string; role: string;
  assignedCompanyIds: string[]; preferredTheme: string;
  preferredLanguage: string; preferredRegion: string;
  mustChangePassword?: boolean; otpEnabled?: boolean;
}

export interface LoginResult {
  success: boolean; error?: string;
  step?: 'credentials' | 'otp' | 'set_password';
  userId?: string; otpId?: string; devToken?: string;
}

interface SessionPayload {
  status?: string;
  token?: string;
  user?: AuthUser;
  otpId?: string;
  userId?: string;
  changeToken?: string;
  devToken?: string;
  error?: string;
}

const USER_KEY = 'facturapro_user';
const CHANGE_TOKEN_KEY = 'facturapro_change_token';

const DEMO_USER: AuthUser = {
  id: 'demo', name: 'Demo', email: 'demo', role: 'admin', assignedCompanyIds: [],
  preferredTheme: 'light', preferredLanguage: 'es', preferredRegion: 'DO',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  user = signal<AuthUser | null>(this.loadStored());
  isAuthenticated = computed(() => !!this.user());
  isAdmin = computed(() => this.user()?.role === 'admin');

  private pendingPurpose: 'login' | 'reset' = 'reset';

  constructor(private db: DbService) {
    void this.restoreSession();
  }

  // ── session bootstrap ─────────────────────────────────────────────────────
  private async restoreSession(): Promise<void> {
    const stored = this.loadStored();
    if (stored?.id === 'demo') {
      this.user.set(stored);
      return;
    }
    if (!getAuthToken()) {
      this.persist(null);
      return;
    }
    const { data } = await apiFetch<{ user: AuthUser }>('/api/auth/me', { method: 'GET' });
    this.persist(data?.user ?? null);
  }

  private loadStored(): AuthUser | null {
    try { const s = localStorage.getItem(USER_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
  }

  private persist(u: AuthUser | null) {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
    this.user.set(u);
  }

  private storeChangeToken(token: string | null) {
    if (token) sessionStorage.setItem(CHANGE_TOKEN_KEY, token);
    else sessionStorage.removeItem(CHANGE_TOKEN_KEY);
  }

  private readChangeToken(): string | null {
    return sessionStorage.getItem(CHANGE_TOKEN_KEY);
  }

  canAccessCompany(companyId: string): boolean {
    const u = this.user();
    if (!u) return false;
    if (u.role === 'admin' || u.id === 'demo') return true;
    return u.assignedCompanyIds.includes(companyId);
  }

  // ── login ─────────────────────────────────────────────────────────────────
  async login(email: string, password: string): Promise<LoginResult> {
    const identifier = email.toLowerCase().trim();

    if ((identifier === 'demo' || identifier === 'demo@demo.com') && password === 'demo') {
      this.persist(DEMO_USER);
      return { success: true };
    }

    const { data, error } = await apiFetch<SessionPayload>('/api/auth/login', {
      body: { email: identifier, password },
    });

    if (error || !data) {
      return { success: false, error: error?.message ?? 'Error de autenticación' };
    }

    if (data.status === 'authenticated' && data.token && data.user) {
      setAuthToken(data.token);
      this.persist(data.user);
      return { success: true };
    }

    if (data.status === 'otp_required') {
      this.pendingPurpose = 'login';
      return { success: false, step: 'otp', userId: data.userId, otpId: data.otpId, devToken: data.devToken };
    }

    if (data.status === 'password_change_required') {
      this.storeChangeToken(data.changeToken ?? null);
      return { success: false, step: 'set_password', userId: data.userId };
    }

    return { success: false, error: 'Respuesta inesperada del servidor' };
  }

  async completeOtpLogin(userId: string): Promise<LoginResult> {
    if (this.user()) return { success: true };
    const { data } = await apiFetch<{ user: AuthUser }>('/api/auth/me', { method: 'GET' });
    if (!data?.user) return { success: false, error: 'No se pudo completar la sesión' };
    this.persist(data.user);
    return { success: true };
  }

  // ── password reset / OTP ──────────────────────────────────────────────────
  async requestPasswordReset(email: string): Promise<{ success: boolean; error?: string; otpId?: string; devToken?: string }> {
    this.pendingPurpose = 'reset';
    const { data, error } = await apiFetch<SessionPayload>('/api/auth/otp/request', {
      body: { email: email.toLowerCase().trim(), purpose: 'reset' },
    });
    if (error || !data) return { success: false, error: error?.message ?? 'Error al enviar el código' };
    return { success: true, otpId: data.otpId, devToken: data.devToken };
  }

  async verifyOtp(otpId: string, token: string): Promise<{ success: boolean; error?: string; userId?: string }> {
    const { data, error } = await apiFetch<SessionPayload>('/api/auth/otp/verify', {
      body: { otpId, token, purpose: this.pendingPurpose },
    });
    if (error || !data) return { success: false, error: error?.message ?? 'Código inválido' };

    if (data.status === 'authenticated' && data.token && data.user) {
      setAuthToken(data.token);
      this.persist(data.user);
      return { success: true, userId: data.user.id };
    }

    if (data.status === 'password_change_required') {
      this.storeChangeToken(data.changeToken ?? null);
      return { success: true, userId: data.userId };
    }

    return { success: true };
  }

  async setNewPassword(_userId: string, password: string, confirm: string): Promise<{ success: boolean; error?: string }> {
    if (password !== confirm) return { success: false, error: 'Las contraseñas no coinciden' };
    if (password.length < 8) return { success: false, error: 'Mínimo 8 caracteres' };

    const changeToken = this.readChangeToken();
    if (!changeToken) return { success: false, error: 'La sesión de cambio de contraseña expiró' };

    const { data, error } = await apiFetch<SessionPayload>('/api/auth/password', {
      token: changeToken,
      body: { password, confirmPassword: confirm },
    });
    if (error || !data) return { success: false, error: error?.message ?? 'No se pudo actualizar la contraseña' };

    this.storeChangeToken(null);
    if (data.token && data.user) {
      setAuthToken(data.token);
      this.persist(data.user);
    }
    return { success: true };
  }

  async logout() {
    await apiFetch('/api/auth/logout', { body: {} });
    setAuthToken(null);
    this.storeChangeToken(null);
    this.persist(null);
  }

  async updatePreferences(prefs: { theme?: string; language?: string; region?: string }) {
    const u = this.user();
    if (!u) return;
    const { data } = await apiFetch<{ user: AuthUser }>('/api/auth/preferences', {
      method: 'PATCH',
      body: prefs,
    });
    if (data?.user) this.persist(data.user);
  }

  // ── helpers used by the admin screens ─────────────────────────────────────
  generateTempPassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 15 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  async sendWelcomeEmail(email: string, name: string, tempPassword: string, lang = 'es') {
    const tpls: Record<string, { subject: string; body: string }> = {
      es: { subject: 'FacturaPro — Tu cuenta ha sido creada', body: `Hola ${name},\n\nTu contraseña temporal:\n\n{{token}}\n\nDeberás cambiarla al iniciar sesión.` },
      en: { subject: 'FacturaPro — Your account has been created', body: `Hi ${name},\n\nYour temporary password:\n\n{{token}}\n\nChange it on first login.` },
      fr: { subject: 'FacturaPro — Votre compte a été créé', body: `Bonjour ${name},\n\nVotre mot de passe temporaire :\n\n{{token}}\n\nVous devrez le changer à la première connexion.` },
    };
    const tpl = tpls[lang] ?? tpls['es'];
    await this.db.request('/api/mail/send', {
      body: { to: email, subject: tpl.subject, body: tpl.body, variables: { token: tempPassword } },
    });
  }
}
