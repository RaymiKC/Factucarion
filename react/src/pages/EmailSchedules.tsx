import { useState } from 'react';
import { Plus, Mail, Clock, CreditCard as Edit2, Trash2, Play, Pause, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEmailSchedules, useEmailLog, useFeatureFlags } from '../lib/hooks';
import type { EmailSchedule } from '../lib/supabase';
import Modal from '../components/Modal';
import { formatDateTime } from '../lib/utils';
import { useI18n } from '../lib/i18n';

const empty: Omit<EmailSchedule, 'id' | 'created_at' | 'updated_at' | 'last_run'> = {
  name: '',
  trigger_event: 'invoice_due',
  days_offset: 0,
  subject: '',
  body_template: '',
  is_active: true,
};

interface EmailSchedulesProps {
  companyId?: string;
}

export default function EmailSchedules({ companyId }: EmailSchedulesProps) {
  const { t } = useI18n();
  const { schedules, loading, refetch } = useEmailSchedules(companyId);
  const { logs } = useEmailLog();
  const { isEnabled, toggle, flags } = useFeatureFlags();

  const triggerLabels: Record<EmailSchedule['trigger_event'], string> = {
    invoice_due: t('event_invoice_due'),
    overdue: t('event_overdue'),
    payment_reminder: t('event_payment_reminder'),
    custom: t('event_custom'),
  };
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EmailSchedule | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'schedules' | 'log'>('schedules');
  const [simulating, setSimulating] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  const emailEnabled = isEnabled('email_notifications');
  const timedEnabled = isEnabled('timed_emails');
  const emailFlag = flags.find(f => f.name === 'email_notifications');
  const timedFlag = flags.find(f => f.name === 'timed_emails');

  function openCreate() {
    setEditing(null);
    setForm({ ...empty });
    setShowModal(true);
  }

  function openEdit(s: EmailSchedule) {
    setEditing(s);
    setForm({ name: s.name, trigger_event: s.trigger_event, days_offset: s.days_offset, subject: s.subject, body_template: s.body_template, is_active: s.is_active });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.subject.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from('email_schedules').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id);
    } else {
      await supabase.from('email_schedules').insert({ ...form, ...(companyId ? { company_id: companyId } : {}) });
    }
    setSaving(false);
    setShowModal(false);
    refetch();
  }

  async function toggleActive(s: EmailSchedule) {
    await supabase.from('email_schedules').update({ is_active: !s.is_active }).eq('id', s.id);
    refetch();
  }

  async function handleDelete(id: string) {
    await supabase.from('email_schedules').delete().eq('id', id);
    refetch();
  }

  async function simulate(s: EmailSchedule) {
    setSimulating(s.id);
    setSendResult(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({
          to: 'test@ejemplo.com',
          subject: s.subject,
          body: s.body_template,
          variables: {
            client_name: 'Cliente Demo',
            invoice_number: 'FAC-000001',
            total: '1,500.00',
            due_date: new Date().toLocaleDateString('es-DO'),
            company_name: 'Mi Empresa',
            invoice_link: '#',
          },
          schedule_id: s.id,
          ...(companyId ? { company_id: companyId } : {}),
        }),
      });
      const json = await res.json() as { success?: boolean; error?: string; detail?: string };
      await supabase.from('email_schedules').update({ last_run: new Date().toISOString() }).eq('id', s.id);
      setSendResult({ id: s.id, ok: !!json.success, msg: json.error ?? (json.success ? 'Enviado correctamente' : 'Error desconocido') });
      refetch();
    } catch (e) {
      setSendResult({ id: s.id, ok: false, msg: e instanceof Error ? e.message : 'Error de red' });
    } finally {
      setSimulating(null);
    }
  }

  const variables = ['{{client_name}}', '{{invoice_number}}', '{{total}}', '{{due_date}}', '{{company_name}}', '{{invoice_link}}'];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('email_schedules_title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Automatización de recordatorios y notificaciones</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={15} /> {t('new_rule')}
        </button>
      </div>

      {/* Feature flags */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap gap-6">
        <div className="flex items-center gap-3">
          <Mail size={16} className="text-slate-500 dark:text-slate-400" />
          <span className="text-sm text-slate-700 dark:text-slate-200">Notificaciones Email</span>
          <button onClick={() => emailFlag && toggle(emailFlag.id, !emailEnabled)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${emailEnabled ? 'bg-sky-600' : 'bg-slate-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${emailEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <Clock size={16} className="text-slate-500 dark:text-slate-400" />
          <span className="text-sm text-slate-700 dark:text-slate-200">Emails Programados</span>
          <button onClick={() => timedFlag && toggle(timedFlag.id, !timedEnabled)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${timedEnabled ? 'bg-sky-600' : 'bg-slate-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${timedEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Variables reference */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Variables disponibles para plantillas:</p>
        <div className="flex flex-wrap gap-2">
          {variables.map(v => (
            <code key={v} className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sky-700 px-2 py-0.5 rounded font-mono">{v}</code>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
        {(['schedules', 'log'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === tab ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>
            {tab === 'schedules' ? `Reglas (${schedules.length})` : `Historial (${logs.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'schedules' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">{t('loading_schedules')}</div>
          ) : schedules.length === 0 ? (
            <div className="p-12 text-center">
              <Mail size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('no_schedules')}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {schedules.map(s => (
                <div key={s.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.is_active ? 'bg-sky-100' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <Mail size={16} className={s.is_active ? 'text-sky-600' : 'text-slate-400 dark:text-slate-500'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{s.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-medium">{triggerLabels[s.trigger_event]}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {s.days_offset === 0 ? 'El mismo día' : s.days_offset > 0 ? `${s.days_offset} días después` : `${Math.abs(s.days_offset)} días antes`}
                          </span>
                          {s.last_run && <span className="text-xs text-slate-400 dark:text-slate-500">Último envío: {formatDateTime(s.last_run)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => simulate(s)} disabled={simulating === s.id}
                          className="p-1.5 rounded-lg hover:bg-sky-50 text-slate-400 dark:text-slate-500 hover:text-sky-500 disabled:opacity-50" title="Envío de prueba">
                          {simulating === s.id ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                        </button>
                        <button onClick={() => toggleActive(s)}
                          className={`p-1.5 rounded-lg ${s.is_active ? 'hover:bg-amber-50 text-amber-500' : 'hover:bg-emerald-50 text-emerald-500'}`}>
                          {s.is_active ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 dark:text-slate-500 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">Asunto: {s.subject}</p>
                    {sendResult?.id === s.id && (
                      <div className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg w-fit ${sendResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {sendResult.ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {sendResult.msg}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'log' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-12 text-center">
              <Clock size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Sin historial de emails</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Para</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{t('subject_label')}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Enviado</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{log.to_email}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 truncate max-w-xs">{log.subject}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          log.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : log.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {log.status === 'sent' ? <CheckCircle size={10} /> : log.status === 'failed' ? <XCircle size={10} /> : <Clock size={10} />}
                          {log.status === 'sent' ? 'Enviado' : log.status === 'failed' ? 'Fallido' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">{formatDateTime(log.sent_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar Regla' : 'Nueva Regla de Email'} size="xl">
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nombre de la Regla *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" placeholder="Ej: Recordatorio 7 días antes del vencimiento" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('trigger_event')}</label>
              <select value={form.trigger_event} onChange={e => setForm(f => ({ ...f, trigger_event: e.target.value as EmailSchedule['trigger_event'] }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500">
                <option value="invoice_due">{t('event_invoice_due')}</option>
                <option value="overdue">{t('event_overdue')}</option>
                <option value="payment_reminder">{t('event_payment_reminder')}</option>
                <option value="custom">{t('event_custom')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('days_offset')}</label>
              <input type="number" value={form.days_offset} onChange={e => setForm(f => ({ ...f, days_offset: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                placeholder="0 = mismo día, -7 = 7 días antes, 3 = 3 días después" />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Negativo = antes del evento, positivo = después</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('subject_label')} *</label>
            <input type="text" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              placeholder="Ej: Recordatorio: Factura {{invoice_number}} vence pronto" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('body_label')} *</label>
            <textarea value={form.body_template} onChange={e => setForm(f => ({ ...f, body_template: e.target.value }))}
              rows={5} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              placeholder="Estimado {{client_name}}, ..." />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 text-sky-600 rounded" />
            <label htmlFor="active" className="text-sm text-slate-600 dark:text-slate-400">Regla activa</label>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">{t('cancel')}</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.subject.trim()}
              className="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-50">
              {saving ? t('saving') : editing ? t('save') : t('create_rule_btn')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
