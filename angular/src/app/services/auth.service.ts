import { Injectable, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { DbService } from './db.service';
import { environment } from '../../environments/environment';

export interface AuthUser {
  id: string; name: string; email: string; role: string;
  assignedCompanyIds: string[]; preferredTheme: string;
  preferredLanguage: string; preferredRegion: string;
  mustChangePassword?: boolean; otpEnabled?: boolean;
}

export interface LoginResult {
  success: boolean; error?: string;
  step?: 'credentials' | 'otp' | 'set_password';
  userId?: string; otpId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const USER_KEY = 'facturapro_user';
const LOCKOUT_HOURS = 24;
const MAX_LOGIN_ATTEMPTS = 3;
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 3;

@Injectable({ providedIn: 'root' })
export class AuthService {
  user = signal<AuthUser | null>(this.loadStored());
  isAuthenticated = computed(() => !!this.user());
  isAdmin = computed(() => this.user()?.role === 'admin');

  constructor(private supabase: SupabaseService, private dbSvc: DbService) {}

  private get db() { return this.supabase.client; }

  private loadStored(): AuthUser | null {
    try { const s = localStorage.getItem(USER_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
  }

  private persist(u: AuthUser | null) {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
    this.user.set(u);
  }

  canAccessCompany(companyId: string): boolean {
    const u = this.user();
    if (!u) return false;
    if (u.role === 'admin') return true;
    return u.assignedCompanyIds.includes(companyId);
  }

  // ---------------------------------------------------------------------------
  // Generic read helper — routes to proxy or Supabase depending on provider
  // ---------------------------------------------------------------------------
  private async dbUpdate(table: string, updates: Record<string, unknown>, filters: Record<string, unknown>): Promise<void> {
    if (!this.dbSvc.isSupabase()) {
      await this.dbSvc.proxyMutate({ operation: 'update', table, data: updates, filters });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = this.db.from(table).update(updates);
    for (const [k, v] of Object.entries(filters)) {
      q = q.eq(k, v);
    }
    await q;
  }

  async login(email: string, password: string): Promise<LoginResult> {
    if ((email.toLowerCase() === 'demo' || email.toLowerCase() === 'demo@demo.com') && password === 'demo') {
      const demo: AuthUser = { id: 'demo', name: 'Demo', email: 'demo', role: 'admin', assignedCompanyIds: [], preferredTheme: 'light', preferredLanguage: 'es', preferredRegion: 'DO' };
      this.persist(demo);
      return { success: true };
    }

    let profile: Row | null;
    if (!this.dbSvc.isSupabase()) {
      const { data } = await this.dbSvc.proxyQuery<Row>('users_config', {
        select: 'id,name,email,role,is_active,password_hash,preferred_theme,preferred_language,preferred_region,must_change_password,otp_enabled,failed_login_attempts,locked_until,temp_password,email_language',
        filters: { email: email.toLowerCase().trim() },
        limit: 1,
      });
      profile = data?.[0] ?? null;
    } else {
      const { data } = await this.db.from('users_config')
        .select('id,name,email,role,is_active,password_hash,preferred_theme,preferred_language,preferred_region,must_change_password,otp_enabled,failed_login_attempts,locked_until,temp_password,email_language')
        .eq('email', email.toLowerCase().trim()).maybeSingle() as { data: Row | null };
      profile = data;
    }

    if (!profile) return { success: false, error: 'Usuario o contraseña incorrectos' };
    if (profile['locked_until'] && new Date(profile['locked_until']) > new Date()) {
      return { success: false, error: `Cuenta bloqueada hasta ${new Date(profile['locked_until']).toLocaleString()}` };
    }
    if (!profile['is_active']) return { success: false, error: 'Cuenta inactiva.' };

    let ok = false;
    const isTempLogin = profile['temp_password'] && password === profile['temp_password'];
    if (isTempLogin) { ok = true; }
    else { ok = await this.verifyPasswordHash(password, profile['password_hash'] ?? ''); }

    if (!ok) {
      const attempts = ((profile['failed_login_attempts'] as number) ?? 0) + 1;
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        await this.dbUpdate('users_config', { failed_login_attempts: 0, locked_until: new Date(Date.now() + LOCKOUT_HOURS * 3600000).toISOString() }, { id: profile['id'] });
        return { success: false, error: `Demasiados intentos. Bloqueado por ${LOCKOUT_HOURS}h.` };
      }
      await this.dbUpdate('users_config', { failed_login_attempts: attempts }, { id: profile['id'] });
      return { success: false, error: `Contraseña incorrecta. ${MAX_LOGIN_ATTEMPTS - attempts} intento(s) restante(s).` };
    }

    await this.dbUpdate('users_config', { failed_login_attempts: 0, locked_until: null, last_login: new Date().toISOString() }, { id: profile['id'] });

    if (isTempLogin || profile['must_change_password']) {
      return { success: false, step: 'set_password', userId: profile['id'] };
    }

    let needsOtp = false;
    if (!this.dbSvc.isSupabase()) {
      const { data: ff } = await this.dbSvc.proxyQuery<Row>('feature_flags', { filters: { name: 'otp_required_for_all' }, limit: 1 });
      needsOtp = (ff?.[0]?.['is_enabled'] ?? false) || profile['otp_enabled'];
    } else {
      const { data: ff } = await this.db.from('feature_flags').select('is_enabled').eq('name', 'otp_required_for_all').maybeSingle() as { data: Row | null };
      needsOtp = (ff?.['is_enabled'] ?? false) || profile['otp_enabled'];
    }

    if (needsOtp) {
      const otpResult = await this.createOtp(profile['id'], profile['email']);
      await this.sendOtpEmail(profile['email'], profile['name'], otpResult.token, 'login', profile['email_language'] ?? 'es');
      return { success: false, step: 'otp', userId: profile['id'], otpId: otpResult.id };
    }

    const authUser = await this.buildUser(profile);
    this.persist(authUser);
    return { success: true };
  }

  async completeOtpLogin(userId: string): Promise<LoginResult> {
    let p: Row | null;
    if (!this.dbSvc.isSupabase()) {
      const { data } = await this.dbSvc.proxyQuery<Row>('users_config', {
        select: 'id,name,email,role,is_active,preferred_theme,preferred_language,preferred_region,must_change_password,otp_enabled',
        filters: { id: userId }, limit: 1,
      });
      p = data?.[0] ?? null;
    } else {
      const { data } = await this.db.from('users_config').select('id,name,email,role,is_active,preferred_theme,preferred_language,preferred_region,must_change_password,otp_enabled').eq('id', userId).maybeSingle() as { data: Row | null };
      p = data;
    }
    if (!p) return { success: false, error: 'Usuario no encontrado' };
    const u = await this.buildUser(p);
    this.persist(u);
    return { success: true };
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; error?: string; otpId?: string }> {
    let p: Row | null;
    if (!this.dbSvc.isSupabase()) {
      const { data } = await this.dbSvc.proxyQuery<Row>('users_config', { select: 'id,name,email,is_active,email_language', filters: { email: email.toLowerCase().trim() }, limit: 1 });
      p = data?.[0] ?? null;
    } else {
      const { data } = await this.db.from('users_config').select('id,name,email,is_active,email_language').eq('email', email.toLowerCase().trim()).maybeSingle() as { data: Row | null };
      p = data;
    }
    if (!p || !p['is_active']) return { success: true };
    const { id: otpId, token } = await this.createOtp(p['id'], p['email']);
    await this.sendOtpEmail(p['email'], p['name'], token, 'reset', p['email_language'] ?? 'es');
    return { success: true, otpId };
  }

  async verifyOtp(otpId: string, token: string): Promise<{ success: boolean; error?: string; userId?: string }> {
    let otp: Row | null;
    if (!this.dbSvc.isSupabase()) {
      const { data } = await this.dbSvc.proxyQuery<Row>('otp_tokens', { filters: { id: otpId }, limit: 1 });
      otp = data?.[0] ?? null;
    } else {
      const { data } = await this.db.from('otp_tokens').select('*').eq('id', otpId).maybeSingle() as { data: Row | null };
      otp = data;
    }
    if (!otp) return { success: false, error: 'Código inválido' };
    if (otp['used']) return { success: false, error: 'Este código ya fue utilizado' };
    if (new Date(otp['expires_at']) < new Date()) return { success: false, error: 'El código ha expirado.' };
    if ((otp['attempts'] as number) >= MAX_OTP_ATTEMPTS) return { success: false, error: 'Demasiados intentos.' };
    if (otp['token'] !== token.trim()) {
      const na = (otp['attempts'] as number) + 1;
      await this.dbUpdate('otp_tokens', { attempts: na }, { id: otpId });
      if (na >= MAX_OTP_ATTEMPTS) {
        await this.dbUpdate('users_config', { is_active: false }, { id: otp['user_id'] });
        return { success: false, error: 'Demasiados intentos. Cuenta desactivada.' };
      }
      return { success: false, error: `Código incorrecto. ${MAX_OTP_ATTEMPTS - na} intento(s) restante(s).` };
    }
    await this.dbUpdate('otp_tokens', { used: true }, { id: otpId });
    return { success: true, userId: otp['user_id'] };
  }

  async setNewPassword(userId: string, password: string, confirm: string): Promise<{ success: boolean; error?: string }> {
    if (password !== confirm) return { success: false, error: 'Las contraseñas no coinciden' };
    if (password.length < 8) return { success: false, error: 'Mínimo 8 caracteres' };
    const hash = await this.hashPassword(password);
    await this.dbUpdate('users_config', { password_hash: hash, must_change_password: false, temp_password: null, failed_login_attempts: 0, locked_until: null }, { id: userId });
    return { success: true };
  }

  async logout() {
    if (this.dbSvc.isSupabase()) {
      await this.db.auth.signOut().catch(() => {});
    }
    this.persist(null);
  }

  async updatePreferences(prefs: { theme?: string; language?: string; region?: string }) {
    const u = this.user();
    if (!u) return;
    const updates: Record<string, string> = {};
    if (prefs.theme) updates['preferred_theme'] = prefs.theme;
    if (prefs.language) updates['preferred_language'] = prefs.language;
    if (prefs.region) updates['preferred_region'] = prefs.region;
    if (!Object.keys(updates).length) return;
    await this.dbUpdate('users_config', updates, { id: u.id });
    this.persist({ ...u, preferredTheme: prefs.theme ?? u.preferredTheme, preferredLanguage: prefs.language ?? u.preferredLanguage, preferredRegion: prefs.region ?? u.preferredRegion });
  }

  private async buildUser(data: Row): Promise<AuthUser> {
    let assignedCompanyIds: string[] = [];
    if (data['role'] !== 'admin') {
      if (!this.dbSvc.isSupabase()) {
        const { data: a } = await this.dbSvc.proxyQuery<Row>('company_users', { select: 'company_id', filters: { user_config_id: data['id'] } });
        assignedCompanyIds = (a ?? []).map((x: Row) => x['company_id'] as string);
      } else {
        const { data: a } = await this.db.from('company_users').select('company_id').eq('user_config_id', data['id']) as { data: Row[] | null };
        assignedCompanyIds = (a ?? []).map((x: Row) => x['company_id'] as string);
      }
    }
    return {
      id: data['id'] as string, name: data['name'] as string, email: data['email'] as string, role: data['role'] as string, assignedCompanyIds,
      preferredTheme: (data['preferred_theme'] as string) ?? 'light', preferredLanguage: (data['preferred_language'] as string) ?? 'es', preferredRegion: (data['preferred_region'] as string) ?? 'DO',
      mustChangePassword: (data['must_change_password'] as boolean) ?? false, otpEnabled: (data['otp_enabled'] as boolean) ?? false,
    };
  }

  private async createOtp(userId: string, email: string): Promise<{ id: string; token: string }> {
    const token = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000).toISOString();
    // Expire previous OTPs
    await this.dbUpdate('otp_tokens', { used: true }, { user_id: userId, used: false });
    if (!this.dbSvc.isSupabase()) {
      const { data } = await this.dbSvc.proxyMutate<Row>({ operation: 'insert', table: 'otp_tokens', data: { user_id: userId, email: email.toLowerCase(), token, expires_at: expiresAt } });
      return { id: (data?.[0]?.['id'] as string) ?? '', token };
    }
    const { data } = await this.db.from('otp_tokens').insert({ user_id: userId, email: email.toLowerCase(), token, expires_at: expiresAt }).select('id').single() as { data: Row | null };
    return { id: (data?.['id'] as string) ?? '', token };
  }

  private async sendOtpEmail(email: string, name: string, token: string, purpose: 'reset' | 'login' | 'welcome', lang = 'es') {
    const tpls: Record<string, Record<string, { subject: string; body: string }>> = {
      reset: { es: { subject: 'FacturaPro — Código para restablecer contraseña', body: `Hola ${name},\n\nTu código:\n\n{{token}}\n\nExpira en ${OTP_EXPIRY_MINUTES} min.` }, en: { subject: 'FacturaPro — Password reset code', body: `Hi ${name},\n\nYour code:\n\n{{token}}\n\nExpires in ${OTP_EXPIRY_MINUTES} min.` }, fr: { subject: 'FacturaPro — Code de réinitialisation', body: `Bonjour ${name},\n\nVotre code :\n\n{{token}}\n\nExpire dans ${OTP_EXPIRY_MINUTES} min.` } },
      login: { es: { subject: 'FacturaPro — Código de verificación', body: `Hola ${name},\n\nTu código:\n\n{{token}}\n\nExpira en ${OTP_EXPIRY_MINUTES} min.` }, en: { subject: 'FacturaPro — Verification code', body: `Hi ${name},\n\nYour code:\n\n{{token}}\n\nExpires in ${OTP_EXPIRY_MINUTES} min.` }, fr: { subject: 'FacturaPro — Code de vérification', body: `Bonjour ${name},\n\nVotre code :\n\n{{token}}\n\nExpire dans ${OTP_EXPIRY_MINUTES} min.` } },
      welcome: { es: { subject: 'FacturaPro — Tu cuenta ha sido creada', body: `Hola ${name},\n\nTu contraseña temporal:\n\n{{token}}\n\nDeberás cambiarla al iniciar sesión.` }, en: { subject: 'FacturaPro — Your account has been created', body: `Hi ${name},\n\nYour temporary password:\n\n{{token}}\n\nChange it on first login.` }, fr: { subject: 'FacturaPro — Votre compte a été créé', body: `Bonjour ${name},\n\nVotre mot de passe temporaire :\n\n{{token}}\n\nVous devrez le changer à la première connexion.` } },
    };
    const tpl = tpls[purpose]?.[lang] ?? tpls[purpose]?.['es'];
    if (!tpl) return;
    await fetch(`${environment.supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${environment.supabaseAnonKey}` },
      body: JSON.stringify({ to: email, subject: tpl.subject, body: tpl.body, variables: { token } })
    }).catch(() => {});
  }

  async hashPassword(password: string): Promise<string> {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(password));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async verifyPasswordHash(password: string, hash: string): Promise<boolean> {
    if (!hash) return false;
    const computed = await this.hashPassword(password);
    return computed === hash;
  }

  generateTempPassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 15 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  async sendWelcomeEmail(email: string, name: string, tempPassword: string, lang = 'es') {
    await this.sendOtpEmail(email, name, tempPassword, 'welcome', lang);
  }
}
