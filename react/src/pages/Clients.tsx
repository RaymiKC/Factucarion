import { useState } from 'react';
import { Plus, Search, CreditCard as Edit2, Trash2, Building2, User, Phone, Mail, X } from 'lucide-react';
import { db } from '../lib/db';
import { useClients } from '../lib/hooks';
import type { Client } from '../lib/types';
import Modal from '../components/Modal';
import { useI18n } from '../lib/i18n';
import { usePermissions } from '../lib/permissions';

const emptyClient: Omit<Client, 'id' | 'created_at' | 'updated_at'> = {
  name: '', email: '', email_list: '', email_body_template: '', phone: '', rnc: '', cedula: '',
  address: '', city: '', country: 'Dominican Republic', client_type: 'business',
  payment_terms: 30, credit_limit: 0, notes: '', is_active: true,
};

interface ClientsProps {
  companyId?: string;
}

export default function Clients({ companyId }: ClientsProps) {
  const { t } = useI18n();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { clients, loading, refetch } = useClients(companyId);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({ ...emptyClient });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.rnc.includes(search) ||
    c.phone.includes(search)
  );

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyClient });
    setShowModal(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setForm({
      name: client.name, email: client.email,
      email_list: client.email_list ?? '', email_body_template: client.email_body_template ?? '',
      phone: client.phone, rnc: client.rnc, cedula: client.cedula, address: client.address,
      city: client.city, country: client.country, client_type: client.client_type,
      payment_terms: client.payment_terms, credit_limit: client.credit_limit,
      notes: client.notes, is_active: client.is_active,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editing) {
      await db.from('clients').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id);
    } else {
      await db.from('clients').insert({ ...form, ...(companyId ? { company_id: companyId } : {}) });
    }
    setSaving(false);
    setShowModal(false);
    refetch();
  }

  async function handleDelete(id: string) {
    await db.from('clients').update({ is_active: false }).eq('id', id);
    setDeleteId(null);
    refetch();
  }

  async function toggleActive(client: Client) {
    await db.from('clients').update({ is_active: !client.is_active }).eq('id', client.id);
    refetch();
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('clients_title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{clients.filter(c => c.is_active).length} {t('active_clients_count')}</p>
        </div>
        {canCreate('clients') && (
          <button onClick={openCreate} className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={15} /> {t('new_client')}
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder={t('search_clients')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">{t('loading_clients')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('no_clients')}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('add_first_client')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden md:table-cell">Contacto</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden lg:table-cell">RNC / Cédula</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden lg:table-cell">Días Crédito</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(client => (
                  <tr key={client.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${client.client_type === 'business' ? 'bg-sky-100' : 'bg-emerald-100'}`}>
                          {client.client_type === 'business'
                            ? <Building2 size={16} className="text-sky-600" />
                            : <User size={16} className="text-emerald-600" />
                          }
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{client.name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{client.city || client.country}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="space-y-0.5">
                        {client.email && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <Mail size={11} /> <span>{client.email}</span>
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <Phone size={11} /> <span>{client.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="text-xs text-slate-600 dark:text-slate-400">{client.rnc || client.cedula || '-'}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="text-xs text-slate-600 dark:text-slate-400">{client.payment_terms} {t('credit_days')}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(client)}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          client.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {client.is_active ? t('active') : t('inactive')}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit('clients') && (
                          <button onClick={() => openEdit(client)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                            <Edit2 size={14} />
                          </button>
                        )}
                        {canDelete('clients') && (
                          <button onClick={() => setDeleteId(client.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? t('edit_client') : t('new_client')} size="xl">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('client_name')}</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" placeholder="Nombre del cliente" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('client_type_label')}</label>
              <select value={form.client_type} onChange={e => setForm(f => ({ ...f, client_type: e.target.value as 'person' | 'business' }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                <option value="business">{t('client_type_business')}</option>
                <option value="person">{t('client_type_person')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{form.client_type === 'business' ? t('tax_id_label') : t('tax_id2_label')}</label>
              <input type="text"
                value={form.client_type === 'business' ? form.rnc : form.cedula}
                onChange={e => setForm(f => form.client_type === 'business' ? { ...f, rnc: e.target.value } : { ...f, cedula: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                placeholder={form.client_type === 'business' ? '000-00000-0' : '000-0000000-0'} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('primary_email')}</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" placeholder="correo@empresa.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('phone')}</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" placeholder="809-000-0000" />
            </div>

            {/* Multi-email list */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t('additional_emails')}
                <span className="ml-1 text-slate-400 dark:text-slate-500 font-normal">({t('additional_emails_hint')})</span>
              </label>
              <EmailListInput
                value={form.email_list}
                onChange={v => setForm(f => ({ ...f, email_list: v }))}
              />
            </div>

            {/* Email body template */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t('email_body')}
                <span className="ml-1 text-slate-400 dark:text-slate-500 font-normal">({t('email_body_hint')})</span>
              </label>
              <textarea
                value={form.email_body_template}
                onChange={e => setForm(f => ({ ...f, email_body_template: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                placeholder={t('email_body_placeholder')}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('email_vars_hint')} <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{{cliente}}"}</code> <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{{numero}}"}</code> <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{{total}}"}</code> <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{"{{vencimiento}}"}</code></p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('address')}</label>
              <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" placeholder="Calle, número, sector" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('city')}</label>
              <input type="text" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" placeholder="Santo Domingo" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('payment_terms_days')}</label>
              <input type="number" value={form.payment_terms} onChange={e => setForm(f => ({ ...f, payment_terms: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" min={0} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('notes')}</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" placeholder="Notas adicionales..." />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              {t('cancel')}
            </button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors disabled:opacity-50">
              {saving ? t('saving') : editing ? t('update_client_btn') : t('create_client_btn')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title={t('deactivate_client')} size="sm">
        <div className="p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{t('deactivate_confirm')}</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">{t('cancel')}</button>
            <button onClick={() => deleteId && handleDelete(deleteId)} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg">{t('deactivate_client')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Users({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function EmailListInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const emails = value ? value.split(',').map(e => e.trim()).filter(Boolean) : [];

  function addEmail() {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed || emails.includes(trimmed)) { setInput(''); return; }
    onChange([...emails, trimmed].join(', '));
    setInput('');
  }

  function removeEmail(email: string) {
    onChange(emails.filter(e => e !== email).join(', '));
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="email"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail(); } }}
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
          placeholder={t('email_placeholder')}
        />
        <button
          type="button"
          onClick={addEmail}
          disabled={!input.trim()}
          className="px-3 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors disabled:opacity-40"
        >
          {t('add_email_btn')}
        </button>
      </div>
      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {emails.map(email => (
            <span key={email} className="inline-flex items-center gap-1 bg-sky-50 border border-sky-200 text-sky-700 text-xs px-2.5 py-1 rounded-full">
              <Mail size={10} />
              {email}
              <button onClick={() => removeEmail(email)} className="ml-0.5 hover:text-red-500 transition-colors">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
