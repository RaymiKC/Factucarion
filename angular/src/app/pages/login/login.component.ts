import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, LoginResult } from '../../services/auth.service';
import { I18nService, Lang } from '../../services/i18n.service';
import { ThemeService } from '../../services/theme.service';

type Screen = 'login' | 'forgot' | 'otp' | 'set_password' | 'done';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
  <!-- Lang switcher -->
  <div class="absolute top-4 right-4 flex gap-1">
    <button *ngFor="let l of langs" (click)="setLang(l.code)"
      [class]="'px-3 py-1.5 rounded-lg text-sm font-medium transition-all ' + (i18n.lang() === l.code ? 'bg-white text-slate-900' : 'text-white/60 hover:text-white hover:bg-white/10')">
      {{l.label}}
    </button>
  </div>

  <div class="w-full max-w-md">
    <!-- Logo -->
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-2xl mb-4">
        <svg class="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
      </div>
      <h1 class="text-3xl font-bold text-white">FacturaPro</h1>
    </div>

    <!-- Card -->
    <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">

      <!-- LOGIN SCREEN -->
      <ng-container *ngIf="screen === 'login'">
        <div class="p-8">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">{{i18n.t('login_title')}}</h2>
          <p class="text-gray-500 dark:text-gray-400 text-sm mb-6">{{i18n.t('login_subtitle')}}</p>
          <form (ngSubmit)="doLogin()" class="space-y-4">
            <div>
              <input [(ngModel)]="loginEmail" name="email" type="text" [placeholder]="i18n.t('login_username_placeholder')" required
                class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all">
            </div>
            <div class="relative">
              <input [(ngModel)]="loginPassword" name="password" [type]="showPassword ? 'text' : 'password'" [placeholder]="i18n.t('login_password_placeholder')" required
                class="w-full px-4 py-3 pr-12 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all">
              <button type="button" (click)="showPassword = !showPassword" class="absolute right-3 top-3 text-gray-400 hover:text-gray-600 p-1">
                <svg *ngIf="!showPassword" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                <svg *ngIf="showPassword" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
              </button>
            </div>
            <div *ngIf="errorMsg" class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl">{{errorMsg}}</div>
            <button type="submit" [disabled]="loading" class="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all">
              {{loading ? i18n.t('login_verifying') : i18n.t('login_btn')}}
            </button>
          </form>
          <button (click)="screen = 'forgot'; errorMsg = ''" class="mt-4 w-full text-sm text-blue-600 dark:text-blue-400 hover:underline text-center">{{i18n.t('login_forgot')}}</button>
          <!-- Demo hint -->
          <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <p class="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">{{i18n.t('login_demo_title')}}</p>
            <p class="text-xs text-blue-600 dark:text-blue-400">demo / demo</p>
          </div>
        </div>
      </ng-container>

      <!-- FORGOT SCREEN -->
      <ng-container *ngIf="screen === 'forgot'">
        <div class="p-8">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">{{i18n.t('forgot_title')}}</h2>
          <p class="text-gray-500 dark:text-gray-400 text-sm mb-6">{{i18n.t('forgot_subtitle')}}</p>
          <form (ngSubmit)="doForgot()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('forgot_email_label')}}</label>
              <input [(ngModel)]="forgotEmail" name="forgotEmail" type="email" [placeholder]="i18n.t('forgot_email_placeholder')" required
                class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div *ngIf="errorMsg" class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl">{{errorMsg}}</div>
            <button type="submit" [disabled]="loading" class="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all">
              {{loading ? i18n.t('forgot_sending') : i18n.t('forgot_send_btn')}}
            </button>
          </form>
          <button (click)="screen = 'login'; errorMsg = ''" class="mt-4 w-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-center">{{i18n.t('forgot_back')}}</button>
        </div>
      </ng-container>

      <!-- OTP SCREEN -->
      <ng-container *ngIf="screen === 'otp'">
        <div class="p-8">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">{{i18n.t('otp_title')}}</h2>
          <p class="text-gray-500 dark:text-gray-400 text-sm mb-2">{{i18n.t('otp_subtitle')}}</p>
          <p class="text-xs text-gray-400 mb-6">{{i18n.t('otp_expiry')}}</p>
          <div class="flex gap-2 justify-center mb-6">
            <input *ngFor="let i of [0,1,2,3,4,5]" [id]="'otp-'+i" [(ngModel)]="otpDigits[i]" name="{{'otp'+i}}"
              type="text" maxlength="1" inputmode="numeric"
              (input)="onOtpInput(i, $event)" (keydown)="onOtpKeyDown(i, $event)"
              (paste)="onOtpPaste($event)"
              class="w-12 h-14 text-center text-2xl font-bold bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-all">
          </div>
          <div *ngIf="errorMsg" class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl mb-4">{{errorMsg}}</div>
          <button (click)="doVerifyOtp()" [disabled]="loading || otpDigits.join('').length < 6"
            class="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all">
            {{loading ? i18n.t('otp_verifying') : i18n.t('otp_verify_btn')}}
          </button>
          <button (click)="screen = 'forgot'; errorMsg = ''" class="mt-3 w-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-center">{{i18n.t('otp_back')}}</button>
        </div>
      </ng-container>

      <!-- SET PASSWORD SCREEN -->
      <ng-container *ngIf="screen === 'set_password'">
        <div class="p-8">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">{{i18n.t('setpass_title')}}</h2>
          <p class="text-gray-500 dark:text-gray-400 text-sm mb-6">{{i18n.t('setpass_subtitle')}}</p>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('setpass_new_label')}}</label>
              <input [(ngModel)]="newPassword" name="newPassword" type="password" [placeholder]="i18n.t('setpass_new_placeholder')"
                class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <!-- Strength bar -->
              <div class="mt-2 flex gap-1">
                <div *ngFor="let s of [1,2,3,4,5]" [class]="'h-1.5 flex-1 rounded-full transition-all ' + (passwordStrength >= s ? strengthColor : 'bg-gray-200 dark:bg-gray-700')"></div>
              </div>
              <p *ngIf="newPassword" class="text-xs mt-1" [class]="strengthTextColor">{{i18n.t('setpass_strength_' + passwordStrength)}}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('setpass_confirm_label')}}</label>
              <input [(ngModel)]="confirmPassword" name="confirmPassword" type="password" [placeholder]="i18n.t('setpass_confirm_placeholder')"
                class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <p *ngIf="confirmPassword" class="text-xs mt-1" [class]="newPassword === confirmPassword ? 'text-green-600' : 'text-red-500'">
                {{i18n.t(newPassword === confirmPassword ? 'setpass_match' : 'setpass_no_match')}}
              </p>
            </div>
            <div *ngIf="errorMsg" class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl">{{errorMsg}}</div>
            <button (click)="doSetPassword()" [disabled]="loading || !newPassword || !confirmPassword"
              class="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all">
              {{loading ? i18n.t('setpass_saving') : i18n.t('setpass_save_btn')}}
            </button>
          </div>
        </div>
      </ng-container>

      <!-- DONE SCREEN -->
      <ng-container *ngIf="screen === 'done'">
        <div class="p-8 text-center">
          <div class="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{i18n.t('done_title')}}</h2>
          <p class="text-gray-500 dark:text-gray-400 mb-6">{{i18n.t('done_subtitle')}}</p>
          <button (click)="screen = 'login'; errorMsg = ''" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all">{{i18n.t('done_back_btn')}}</button>
        </div>
      </ng-container>
    </div>
  </div>
</div>
  `
})
export class LoginComponent {
  screen: Screen = 'login';
  loginEmail = '';
  loginPassword = '';
  forgotEmail = '';
  otpDigits = ['','','','','',''];
  newPassword = '';
  confirmPassword = '';
  showPassword = false;
  loading = false;
  errorMsg = '';
  pendingUserId = '';
  pendingOtpId = '';

  langs = [{ code: 'es' as Lang, label: 'ES' }, { code: 'en' as Lang, label: 'EN' }, { code: 'fr' as Lang, label: 'FR' }];

  constructor(public i18n: I18nService, private auth: AuthService, private router: Router) {}

  setLang(l: Lang) { this.i18n.setLang(l); }

  async doLogin() {
    if (!this.loginEmail || !this.loginPassword) return;
    this.loading = true; this.errorMsg = '';
    const r = await this.auth.login(this.loginEmail, this.loginPassword);
    this.loading = false;
    if (r.success) { this.router.navigate(['/dashboard']); return; }
    if (r.step === 'otp') { this.pendingUserId = r.userId!; this.pendingOtpId = r.otpId!; this.screen = 'otp'; return; }
    if (r.step === 'set_password') { this.pendingUserId = r.userId!; this.screen = 'set_password'; return; }
    this.errorMsg = r.error ?? 'Error';
  }

  async doForgot() {
    if (!this.forgotEmail) return;
    this.loading = true; this.errorMsg = '';
    const r = await this.auth.requestPasswordReset(this.forgotEmail);
    this.loading = false;
    if (r.success && r.otpId) { this.pendingOtpId = r.otpId; this.screen = 'otp'; }
    else if (r.success) { this.errorMsg = 'Si el correo existe, recibirás el código.'; }
    else { this.errorMsg = r.error ?? 'Error'; }
  }

  async doVerifyOtp() {
    const token = this.otpDigits.join('');
    if (token.length < 6) return;
    this.loading = true; this.errorMsg = '';
    const r = await this.auth.verifyOtp(this.pendingOtpId, token);
    this.loading = false;
    if (r.success) {
      if (this.pendingUserId) { await this.auth.completeOtpLogin(r.userId!); this.router.navigate(['/dashboard']); }
      else { this.pendingUserId = r.userId!; this.screen = 'set_password'; }
    } else { this.errorMsg = r.error ?? 'Error'; }
  }

  async doSetPassword() {
    if (!this.newPassword || !this.confirmPassword) return;
    this.loading = true; this.errorMsg = '';
    const r = await this.auth.setNewPassword(this.pendingUserId, this.newPassword, this.confirmPassword);
    this.loading = false;
    if (r.success) this.screen = 'done';
    else this.errorMsg = r.error ?? 'Error';
  }

  onOtpInput(i: number, e: Event) {
    const val = (e.target as HTMLInputElement).value.replace(/\D/g, '');
    this.otpDigits[i] = val.slice(-1);
    if (val && i < 5) document.getElementById('otp-' + (i + 1))?.focus();
  }

  onOtpKeyDown(i: number, e: KeyboardEvent) {
    if (e.key === 'Backspace' && !this.otpDigits[i] && i > 0) document.getElementById('otp-' + (i - 1))?.focus();
  }

  onOtpPaste(e: ClipboardEvent) {
    e.preventDefault();
    const digits = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, 6).split('');
    digits.forEach((d, i) => { if (i < 6) this.otpDigits[i] = d; });
    document.getElementById('otp-' + Math.min(digits.length, 5))?.focus();
  }

  get passwordStrength(): number {
    const p = this.newPassword;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return Math.max(1, s);
  }

  get strengthColor(): string {
    const map = ['','bg-red-500','bg-orange-500','bg-yellow-500','bg-blue-500','bg-green-500'];
    return map[this.passwordStrength] ?? 'bg-gray-200';
  }

  get strengthTextColor(): string {
    const map = ['','text-red-500','text-orange-500','text-yellow-500','text-blue-500','text-green-500'];
    return map[this.passwordStrength] ?? '';
  }
}
