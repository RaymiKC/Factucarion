import { useState, FormEvent, useRef, KeyboardEvent } from 'react';
import { FileText, Eye, EyeOff, Lock, Mail, AlertCircle, CheckCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n, type Language } from '../lib/i18n';

type Screen = 'login' | 'forgot' | 'otp' | 'set_password' | 'done';

const LANGUAGES: { code: Language; flag: string; label: string }[] = [
  { code: 'es', flag: '🇪🇸', label: 'ES' },
  { code: 'en', flag: '🇺🇸', label: 'EN' },
  { code: 'fr', flag: '🇫🇷', label: 'FR' },
];

export default function Login() {
  const { login, requestPasswordReset, verifyOtp, setNewPassword, completeOtpLogin } = useAuth();
  const { t, lang, setLang } = useI18n();

  const [screen, setScreen] = useState<Screen>('login');

  // Login screen
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Forgot screen
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // OTP screen
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpId, setOtpId] = useState('');
  const [pendingUserId, setPendingUserId] = useState('');
  const [otpPurpose, setOtpPurpose] = useState<'reset' | 'login'>('reset');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Set password screen
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passError, setPassError] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [setPassUserId, setSetPassUserId] = useState('');

  // ── Login ──────────────────────────────────────────────────────────────────
  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoginLoading(true);
    setLoginError('');

    const result = await login(email, password);
    setLoginLoading(false);

    if (result.success) return;

    if (result.step === 'set_password' && result.userId) {
      setSetPassUserId(result.userId);
      setNewPass('');
      setConfirmPass('');
      setPassError('');
      setScreen('set_password');
      return;
    }

    if (result.step === 'otp' && result.userId && result.otpId) {
      setPendingUserId(result.userId);
      setOtpId(result.otpId);
      setOtpPurpose('login');
      setOtpDigits(['', '', '', '', '', '']);
      setOtpError('');
      setScreen('otp');
      return;
    }

    setLoginError(result.error ?? t('login_loading'));
  }

  // ── Forgot password ────────────────────────────────────────────────────────
  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    setForgotError('');

    const result = await requestPasswordReset(forgotEmail.trim());
    setForgotLoading(false);

    if (!result.success) {
      setForgotError(result.error ?? 'Error');
      return;
    }

    setOtpId(result.otpId ?? '');
    setPendingUserId('');
    setOtpPurpose('reset');
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError('');
    setScreen('otp');
  }

  // ── OTP input handling ─────────────────────────────────────────────────────
  function handleOtpChange(index: number, value: string) {
    const cleaned = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = cleaned;
    setOtpDigits(next);
    if (cleaned && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtpDigits(next);
    const focusIndex = Math.min(pasted.length, 5);
    otpRefs.current[focusIndex]?.focus();
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault();
    const token = otpDigits.join('');
    if (token.length < 6) return;
    setOtpLoading(true);
    setOtpError('');

    const result = await verifyOtp(otpId, token);
    setOtpLoading(false);

    if (!result.success) {
      setOtpError(result.error ?? 'Error');
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
      return;
    }

    const uid = result.userId ?? pendingUserId;

    if (otpPurpose === 'reset') {
      setSetPassUserId(uid);
      setNewPass('');
      setConfirmPass('');
      setPassError('');
      setScreen('set_password');
    } else {
      const loginResult = await completeOtpLogin(uid);
      if (!loginResult.success) {
        setOtpError(loginResult.error ?? 'Error');
      }
    }
  }

  async function handleResend() {
    setResendLoading(true);
    const emailToUse = otpPurpose === 'reset' ? forgotEmail.trim() : email.trim();
    const result = await requestPasswordReset(emailToUse);
    setResendLoading(false);
    if (result.otpId) {
      setOtpId(result.otpId);
      setOtpDigits(['', '', '', '', '', '']);
      setOtpError('');
      otpRefs.current[0]?.focus();
    }
  }

  // ── Set password ───────────────────────────────────────────────────────────
  async function handleSetPassword(e: FormEvent) {
    e.preventDefault();
    setPassLoading(true);
    setPassError('');

    const result = await setNewPassword(setPassUserId, newPass, confirmPass);
    setPassLoading(false);

    if (!result.success) {
      setPassError(result.error ?? 'Error');
      return;
    }

    setScreen('done');
  }

  function passwordStrength(p: string): { score: number; label: string; color: string } {
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    const labels = [
      t('setpass_strength_1'),
      t('setpass_strength_1'),
      t('setpass_strength_2'),
      t('setpass_strength_3'),
      t('setpass_strength_4'),
      t('setpass_strength_5'),
    ];
    const colors = ['bg-red-400', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400', 'bg-emerald-500'];
    return { score, label: labels[score] ?? labels[0], color: colors[score] ?? colors[0] };
  }

  const strength = passwordStrength(newPass);
  const passwordsMatch = newPass.length > 0 && confirmPass.length > 0 && newPass === confirmPass;

  // ── Shared wrapper ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.03%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />

      <div className="relative w-full max-w-md">
        {/* Language switcher */}
        <div className="flex justify-end mb-3 gap-1">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                lang === l.code
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
              }`}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-slate-900 px-8 py-8 text-center">
            <div className="w-14 h-14 bg-sky-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <FileText size={26} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">{t('app_name')}</h1>
            <p className="text-slate-400 text-sm mt-1">{t('app_subtitle')}</p>
          </div>

          <div className="px-8 py-8">

            {/* ── Login ── */}
            {screen === 'login' && (
              <>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">{t('login_title')}</h2>
                <p className="text-sm text-slate-500 mb-6">{t('login_subtitle')}</p>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">{t('login_email')}</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder={t('login_username_placeholder')}
                        autoComplete="username"
                        className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">{t('login_password')}</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={t('login_password_placeholder')}
                        autoComplete="current-password"
                        className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                      />
                      <button type="button" onClick={() => setShowPass(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {loginError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                      <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600">{loginError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loginLoading || !email || !password}
                    className="w-full bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    {loginLoading ? (
                      <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('login_verifying')}</>
                    ) : t('login_btn')}
                  </button>
                </form>

                <button
                  onClick={() => { setForgotEmail(''); setForgotError(''); setScreen('forgot'); }}
                  className="w-full mt-3 text-xs text-sky-600 hover:text-sky-700 text-center transition-colors"
                >
                  {t('login_forgot')}
                </button>

                <div className="mt-5 p-3 bg-sky-50 border border-sky-100 rounded-lg">
                  <p className="text-xs font-semibold text-sky-700 mb-0.5">{t('login_demo_title')}</p>
                  <p className="text-xs text-sky-600">
                    {lang === 'es' && <></>}
                    {t('login_email')}: <code className="font-mono bg-sky-100 px-1 rounded">demo</code>
                    &nbsp;&nbsp;
                    {t('login_password')}: <code className="font-mono bg-sky-100 px-1 rounded">demo</code>
                  </p>
                </div>
              </>
            )}

            {/* ── Forgot ── */}
            {screen === 'forgot' && (
              <>
                <button onClick={() => setScreen('login')} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-5 transition-colors">
                  <ArrowLeft size={13} /> {t('forgot_back')}
                </button>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">{t('forgot_title')}</h2>
                <p className="text-sm text-slate-500 mb-6">{t('forgot_subtitle')}</p>

                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">{t('forgot_email_label')}</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        placeholder={t('forgot_email_placeholder')}
                        autoComplete="email"
                        className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {forgotError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                      <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600">{forgotError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={forgotLoading || !forgotEmail.trim()}
                    className="w-full bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {forgotLoading ? (
                      <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('forgot_sending')}</>
                    ) : t('forgot_send_btn')}
                  </button>
                </form>
              </>
            )}

            {/* ── OTP ── */}
            {screen === 'otp' && (
              <>
                <button onClick={() => setScreen(otpPurpose === 'reset' ? 'forgot' : 'login')} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-5 transition-colors">
                  <ArrowLeft size={13} /> {t('otp_back')}
                </button>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">{t('otp_title')}</h2>
                <p className="text-sm text-slate-500 mb-2">{t('otp_subtitle')}</p>
                <p className="text-xs text-slate-400 mb-6">{t('otp_expiry')}</p>

                <form onSubmit={handleOtpSubmit} className="space-y-5">
                  <div className="flex justify-center gap-2">
                    {otpDigits.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        onPaste={i === 0 ? handleOtpPaste : undefined}
                        className="w-11 h-14 text-center text-xl font-bold font-mono border-2 border-slate-200 rounded-xl focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all text-slate-800 bg-slate-50"
                      />
                    ))}
                  </div>

                  {otpError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                      <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600">{otpError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={otpLoading || otpDigits.join('').length < 6}
                    className="w-full bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {otpLoading ? (
                      <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('otp_verifying')}</>
                    ) : t('otp_verify_btn')}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <button
                    onClick={handleResend}
                    disabled={resendLoading}
                    className="text-xs text-slate-500 hover:text-sky-600 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={resendLoading ? 'animate-spin' : ''} />
                    {resendLoading ? t('otp_resending') : t('otp_resend')}
                  </button>
                </div>
              </>
            )}

            {/* ── Set password ── */}
            {screen === 'set_password' && (
              <>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">{t('setpass_title')}</h2>
                <p className="text-sm text-slate-500 mb-6">{t('setpass_subtitle')}</p>

                <form onSubmit={handleSetPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">{t('setpass_new_label')}</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={newPass}
                        onChange={e => setNewPass(e.target.value)}
                        placeholder={t('setpass_new_placeholder')}
                        autoComplete="new-password"
                        className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                      />
                      <button type="button" onClick={() => setShowNew(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {newPass.length > 0 && (
                      <div className="mt-2">
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3, 4, 5].map(n => (
                            <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${n <= strength.score ? strength.color : 'bg-slate-200'}`} />
                          ))}
                        </div>
                        <p className="text-xs text-slate-500">{strength.label}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">{t('setpass_confirm_label')}</label>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPass}
                        onChange={e => setConfirmPass(e.target.value)}
                        placeholder={t('setpass_confirm_placeholder')}
                        autoComplete="new-password"
                        className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                      />
                      <button type="button" onClick={() => setShowConfirm(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {confirmPass.length > 0 && (
                      <p className={`text-xs mt-1 ${passwordsMatch ? 'text-emerald-600' : 'text-red-500'}`}>
                        {passwordsMatch ? t('setpass_match') : t('setpass_no_match')}
                      </p>
                    )}
                  </div>

                  {passError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                      <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600">{passError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={passLoading || !newPass || !confirmPass || newPass !== confirmPass || newPass.length < 8}
                    className="w-full bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    {passLoading ? (
                      <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('setpass_saving')}</>
                    ) : t('setpass_save_btn')}
                  </button>
                </form>
              </>
            )}

            {/* ── Done ── */}
            {screen === 'done' && (
              <div className="text-center py-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={28} className="text-emerald-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-800 mb-2">{t('done_title')}</h2>
                <p className="text-sm text-slate-500 mb-6">{t('done_subtitle')}</p>
                <button
                  onClick={() => { setScreen('login'); setPassword(''); setLoginError(''); }}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
                >
                  {t('done_back_btn')}
                </button>
              </div>
            )}

          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-5">FacturaPro &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
