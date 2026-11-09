import { useState } from 'react';
import {
  CheckCircle2, XCircle, RefreshCw,
  Settings, AlertCircle,
  Server, Globe, Hash, Webhook, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, Save, Activity, ShieldCheck, ExternalLink,
} from 'lucide-react';
import { useFeatureFlags, useEcfProviderConfig } from '../lib/hooks';
import type { EcfProviderConfig } from '../lib/types';

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-400 dark:text-slate-500 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, collapsible = false }: {
  title: string; icon: React.ElementType; children: React.ReactNode; collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <button
        onClick={() => collapsible && setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 ${collapsible ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-sky-50 rounded-lg flex items-center justify-center">
            <Icon size={14} className="text-sky-600" />
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</span>
        </div>
        {collapsible && (open ? <ChevronUp size={14} className="text-slate-400 dark:text-slate-500" /> : <ChevronDown size={14} className="text-slate-400 dark:text-slate-500" />)}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

interface ElectronicProps {
  companyId?: string;
}

export default function Electronic({ companyId: _companyId }: ElectronicProps) {
  const { isEnabled, toggle, flags } = useFeatureFlags();
  const { config: providerConfig, loading: configLoading, save: saveConfig } = useEcfProviderConfig();

  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const [local, setLocal] = useState<Partial<EcfProviderConfig>>({});
  const merged = { ...providerConfig, ...local } as EcfProviderConfig;

  function set<K extends keyof EcfProviderConfig>(key: K, value: EcfProviderConfig[K]) {
    setLocal(l => ({ ...l, [key]: value }));
  }

  const enabled = isEnabled('electronic_invoicing');
  const flag = flags.find(f => f.name === 'electronic_invoicing');

  async function handleSaveConfig() {
    setSaving(true);
    await saveConfig(local);
    setLocal({});
    setSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2500);
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const url = merged.own_service_url?.trim();
      if (!url) throw new Error('URL del servicio no configurada');
      const res = await fetch(`${url}/health`, {
        headers: { Authorization: `Bearer ${merged.own_service_token}` },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        setTestResult({ ok: true, msg: `Conexión exitosa (HTTP ${res.status})` });
      } else {
        setTestResult({ ok: false, msg: `Servidor respondió HTTP ${res.status}` });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      setTestResult({ ok: false, msg });
    }
    setTesting(false);
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500';
  const selectCls = inputCls;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Facturación Electrónica</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Configuración del servicio de e-CF — DGII</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-slate-500 dark:text-slate-400">Módulo</span>
          <button
            onClick={() => flag && toggle(flag.id, !enabled)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-sky-600' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {!enabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Módulo desactivado</p>
            <p className="text-xs text-amber-600 mt-0.5">Activa la facturación electrónica para enviar e-CFs a la DGII.</p>
          </div>
        </div>
      )}

      {/* Mode selector */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Modo de operación</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            {
              value: 'own_service',
              label: 'Servicio Propio',
              desc: 'Utilizo mi propio endpoint de e-CF para procesar y enviar a la DGII.',
              icon: Server,
              accent: 'sky',
            },
            {
              value: 'third_party',
              label: 'Proveedor Externo',
              desc: 'Uso un proveedor tercero como nFact, eComprobante u otro.',
              icon: Globe,
              accent: 'slate',
            },
          ] as const).map(({ value, label, desc, icon: Icon, accent }) => {
            const active = (merged.mode ?? 'third_party') === value;
            return (
              <button
                key={value}
                onClick={() => set('mode', value)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  active
                    ? `border-${accent}-500 bg-${accent}-50`
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? `bg-${accent}-100` : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <Icon size={16} className={active ? `text-${accent}-600` : 'text-slate-500 dark:text-slate-400'} />
                  </div>
                  <span className={`text-sm font-semibold ${active ? `text-${accent}-700` : 'text-slate-600 dark:text-slate-400'}`}>{label}</span>
                  {active && <CheckCircle2 size={14} className={`text-${accent}-500 ml-auto`} />}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Own Service Config */}
      {(merged.mode ?? 'third_party') === 'own_service' && (
        <>
          <SectionCard title="Endpoint del Servicio" icon={Server} collapsible>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldRow label="URL Base del Servicio" hint="Ej: https://ecf.miempresa.com/api/v1">
                  <input
                    value={merged.own_service_url ?? ''}
                    onChange={e => set('own_service_url', e.target.value)}
                    placeholder="https://ecf.tuservicio.com/api/v1"
                    className={inputCls}
                  />
                </FieldRow>
                <FieldRow label="Ambiente">
                  <select value={merged.own_service_environment ?? 'sandbox'} onChange={e => set('own_service_environment', e.target.value as 'sandbox' | 'production')} className={selectCls}>
                    <option value="sandbox">Sandbox (Pruebas)</option>
                    <option value="production">Producción</option>
                  </select>
                </FieldRow>
              </div>
              <FieldRow label="Token de Autenticación (Bearer)" hint="Se enviará en el header Authorization: Bearer <token>">
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={merged.own_service_token ?? ''}
                    onChange={e => set('own_service_token', e.target.value)}
                    placeholder="sk-••••••••••••••••"
                    className={`${inputCls} pr-20`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 font-medium"
                  >
                    {showToken ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </FieldRow>
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleTestConnection}
                  disabled={testing || !merged.own_service_url}
                  className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {testing ? <RefreshCw size={13} className="animate-spin" /> : <Activity size={13} />}
                  {testing ? 'Probando...' : 'Probar Conexión'}
                </button>
                {testResult && (
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${testResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                    {testResult.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                    {testResult.msg}
                  </span>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Secuencias NCF" icon={Hash} collapsible>
            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">Las secuencias NCF se administran en la pestaña <strong>Facturas → Secuencias NCF</strong>. El sistema avanzará el contador automáticamente al aprobar cada e-CF.</p>
            </div>
          </SectionCard>

          <SectionCard title="Webhook de Respuesta" icon={Webhook} collapsible>
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Opcional. Si tu servicio recibe callbacks de la DGII, configura la URL y secreto para validar firmas.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldRow label="URL del Webhook" hint="Tu endpoint que recibirá las respuestas">
                  <input
                    value={merged.webhook_url ?? ''}
                    onChange={e => set('webhook_url', e.target.value)}
                    placeholder="https://tuapp.com/webhooks/ecf"
                    className={inputCls}
                  />
                </FieldRow>
                <FieldRow label="Secreto del Webhook">
                  <div className="relative">
                    <input
                      type={showWebhookSecret ? 'text' : 'password'}
                      value={merged.webhook_secret ?? ''}
                      onChange={e => set('webhook_secret', e.target.value)}
                      placeholder="whsec_••••••••"
                      className={`${inputCls} pr-20`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowWebhookSecret(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 font-medium"
                    >
                      {showWebhookSecret ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                </FieldRow>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Comportamiento Automático" icon={Settings} collapsible>
            <div className="space-y-3">
              {([
                { key: 'auto_submit' as const, label: 'Envío automático', desc: 'Enviar el e-CF automáticamente al crear o aprobar una factura electrónica' },
                { key: 'retry_on_failure' as const, label: 'Reintentar en fallo', desc: 'Volver a intentar el envío automáticamente si el primer intento es rechazado' },
              ]).map(({ key, label, desc }) => {
                const val = merged[key] ?? false;
                return (
                  <div key={key} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                    </div>
                    <button onClick={() => set(key, !val)}>
                      {val
                        ? <ToggleRight size={22} className="text-sky-600" />
                        : <ToggleLeft size={22} className="text-slate-400 dark:text-slate-500" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <div className="bg-slate-800 rounded-xl p-5 text-sm">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={16} className="text-sky-400" />
              <span className="text-white font-semibold text-sm">Referencia de API esperada</span>
            </div>
            <p className="text-slate-400 text-xs mb-4">Tu servicio debe exponer los siguientes endpoints. FacturaPro los llamará con el token configurado.</p>
            <div className="space-y-3">
              {[
                { method: 'GET', path: '/health', desc: 'Health check — debe retornar 200 OK' },
                { method: 'POST', path: '/ecf/submit', desc: 'Enviar factura a la DGII. Body: { invoice_number, ncf_type, client_rnc, total, tax_amount, issue_date, environment }' },
                { method: 'GET', path: '/ecf/:id/status', desc: 'Consultar el estado de un e-CF por ID' },
              ].map(({ method, path, desc }) => (
                <div key={path} className="flex items-start gap-3">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded font-mono shrink-0 mt-0.5 ${method === 'GET' ? 'bg-emerald-900 text-emerald-300' : 'bg-sky-900 text-sky-300'}`}>{method}</span>
                  <div>
                    <code className="text-sky-300 text-xs">{path}</code>
                    <p className="text-slate-400 text-xs mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700 flex items-center gap-2">
              <ExternalLink size={12} className="text-slate-500" />
              <span className="text-xs text-slate-500">La respuesta de <code className="text-slate-300">/ecf/submit</code> debe incluir <code className="text-slate-300">status: "approved"|"rejected"</code> y opcionalmente <code className="text-slate-300">ecf_id</code>.</span>
            </div>
          </div>
        </>
      )}

      {/* Third-party Config */}
      {(merged.mode ?? 'third_party') === 'third_party' && (
        <SectionCard title="Proveedor Externo" icon={Globe}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldRow label="Proveedor">
              <select value={merged.third_party_provider ?? ''} onChange={e => set('third_party_provider', e.target.value)} className={selectCls}>
                <option value="">Seleccionar proveedor...</option>
                <option value="dgii_direct">DGII Directo</option>
                <option value="nfact">nFact</option>
                <option value="ecomprobante">eComprobante</option>
                <option value="alegra">Alegra e-CF</option>
                <option value="other">Otro</option>
              </select>
            </FieldRow>
            <FieldRow label="Ambiente">
              <select value={merged.own_service_environment ?? 'sandbox'} onChange={e => set('own_service_environment', e.target.value as 'sandbox' | 'production')} className={selectCls}>
                <option value="sandbox">Sandbox (Pruebas)</option>
                <option value="production">Producción</option>
              </select>
            </FieldRow>
            <div className="sm:col-span-2">
              <FieldRow label="API Key / Token">
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={merged.third_party_api_key ?? ''}
                    onChange={e => set('third_party_api_key', e.target.value)}
                    placeholder="Ingresa la clave API del proveedor"
                    className={`${inputCls} pr-20`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 font-medium"
                  >
                    {showToken ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </FieldRow>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Save button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {savedOk && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <CheckCircle2 size={15} /> Configuración guardada
          </span>
        )}
        <button
          onClick={handleSaveConfig}
          disabled={saving || configLoading}
          className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}
