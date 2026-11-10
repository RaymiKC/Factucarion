import { useState, useEffect } from 'react';
import {
  Plus, Search, Eye, Send, Printer, FileText, Trash2, CreditCard, Info,
  RefreshCw, Repeat, Hash, AlertTriangle, CheckCircle, Clock, Zap,
  CheckCircle2, XCircle, Server, FileCheck, CreditCard as Edit2,
} from 'lucide-react';
import { db } from '../lib/db';
import {
  useInvoices, useClients, useProducts, useTaxRates, useSettings,
  useNcfSequences, useNcfVoidLog, useFeatureFlags, useEcfProviderConfig,
} from '../lib/hooks';
import type { Invoice, InvoiceItem, Client, ProductService, NcfSequence } from '../lib/types';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import InvoiceTemplate from '../components/InvoiceTemplate';
import { getDaysUntilDue, generateInvoiceNumber, formatCurrency as fmtCur, formatDate as fmtDt, getElectronicStatusColor, getElectronicStatusLabel } from '../lib/utils';
import { useI18n } from '../lib/i18n';
import { usePermissions } from '../lib/permissions';

type FilterStatus = 'all' | 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';
type InvoiceTab = 'facturas' | 'secuencias' | 'ecf';

interface InvoicesProps { companyId?: string }

interface LineItem {
  id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount_percent: number;
}

async function assignNcf(ncfType: string, companyId?: string): Promise<string> {
  const currentMonth = new Date().toISOString().substring(0, 7);
  let voidQ = db
    .from('ncf_void_log')
    .select('id, ncf')
    .eq('ncf_type', ncfType)
    .eq('reuse_allowed', true)
    .is('reused_by_invoice_id', null)
    .eq('issue_month', currentMonth)
    .order('cancelled_at')
    .limit(1);
  if (companyId) voidQ = voidQ.eq('company_id', companyId);
  const { data: voidRow } = await voidQ.maybeSingle();
  if (voidRow) return voidRow.ncf;

  let seqQ = db
    .from('ncf_sequences')
    .select('*')
    .eq('ncf_type', ncfType)
    .eq('is_active', true);
  if (companyId) seqQ = seqQ.eq('company_id', companyId);
  const { data: seq } = await seqQ.maybeSingle();
  if (!seq) return '';

  const ncf = `${seq.prefix}${String(seq.current_seq).padStart(3, '0')}`;
  await db.from('ncf_sequences').update({
    current_seq: seq.current_seq + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', seq.id);
  return ncf;
}

async function markNcfVoidLog(invoice: Invoice, reuseAllowed: boolean, companyId: string | undefined) {
  await db.from('ncf_void_log').insert({
    company_id: companyId,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    ncf: invoice.ncf,
    ncf_type: invoice.ncf_type,
    issue_month: invoice.issue_date.substring(0, 7),
    reuse_allowed: reuseAllowed,
    notes: reuseAllowed
      ? 'Cancelado dentro del mes de emisión — NCF disponible para reutilización'
      : 'Cancelado fuera del mes de emisión — NCF perdido',
  });
}

const emptySeqForm = {
  ncf_type: 'B01' as NcfSequence['ncf_type'],
  prefix: '',
  from_seq: 1,
  to_seq: 1000,
  current_seq: 1,
  dgii_auth: '',
  expires_at: '',
};

export default function Invoices({ companyId }: InvoicesProps = {}) {
  const { t, formatCurrency, formatDate, regionConfig, lang } = useI18n();
  const { canCreate, canEdit, canDelete } = usePermissions();

  // ── Data hooks ──────────────────────────────────────────────────────────
  const { invoices, loading, refetch }           = useInvoices(companyId);
  const { clients }                              = useClients(companyId);
  const { products }                             = useProducts(companyId);
  const { taxRates }                             = useTaxRates(companyId);
  const { getSetting }                           = useSettings(companyId);
  const { sequences, loading: seqLoading, refetch: refetchSeq } = useNcfSequences(companyId);
  const { logs: voidLogs, loading: voidLoading } = useNcfVoidLog(companyId);
  const { isEnabled, toggle, flags }             = useFeatureFlags();
  const { config: providerConfig }               = useEcfProviderConfig(companyId);

  // ── Tab ─────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<InvoiceTab>('facturas');

  // ── Invoice list state ──────────────────────────────────────────────────
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showCreate, setShowCreate]   = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [payModal, setPayModal]       = useState<Invoice | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<Invoice | null>(null);

  // ── Invoice create form ─────────────────────────────────────────────────
  const [form, setForm] = useState({
    client_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    ncf_type: 'B01',
    notes: '',
    terms: '',
    currency: 'DOP',
    is_electronic: false,
    invoice_type: 'one_time' as 'one_time' | 'recurring',
    recurrence_rule: 'monthly' as Invoice['recurrence_rule'],
    recurrence_end: '',
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), product_id: null, description: '', quantity: 1, unit_price: 0, tax_rate: regionConfig.taxRate, discount_percent: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: 0, payment_method: 'transfer' as const,
    payment_date: new Date().toISOString().split('T')[0],
    reference: '', notes: '',
  });

  // ── NCF sequences state ─────────────────────────────────────────────────
  const [seqModal, setSeqModal]     = useState(false);
  const [editingSeq, setEditingSeq] = useState<NcfSequence | null>(null);
  const [seqForm, setSeqForm]       = useState({ ...emptySeqForm });

  // ── e-CF state ──────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState<string | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────
  const electronicEnabled  = isEnabled('electronic_invoicing');
  const electronicFlag     = flags.find(f => f.name === 'electronic_invoicing');
  const electronicInvoices = invoices.filter(i => i.is_electronic);

  const filtered = invoices.filter(inv => {
    const matchSearch = !search
      || inv.invoice_number.toLowerCase().includes(search.toLowerCase())
      || (inv.client as Client | undefined)?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusCounts = invoices.reduce((acc, inv) => {
    acc[inv.status] = (acc[inv.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ── Line item helpers ────────────────────────────────────────────────────
  function calcLine(item: LineItem) {
    const subtotal = item.quantity * item.unit_price;
    const disc     = subtotal * (item.discount_percent / 100);
    const taxable  = subtotal - disc;
    const tax      = taxable * (item.tax_rate / 100);
    return { subtotal, disc, tax, total: taxable + tax };
  }

  const totals = lineItems.reduce((acc, item) => {
    const c = calcLine(item);
    return { subtotal: acc.subtotal + c.subtotal, discount: acc.discount + c.disc, tax: acc.tax + c.tax, total: acc.total + c.total };
  }, { subtotal: 0, discount: 0, tax: 0, total: 0 });

  function addLine() {
    setLineItems(l => [...l, { id: crypto.randomUUID(), product_id: null, description: '', quantity: 1, unit_price: 0, tax_rate: 18, discount_percent: 0 }]);
  }
  function removeLine(id: string) { setLineItems(l => l.filter(i => i.id !== id)); }
  function updateLine(id: string, field: keyof LineItem, value: string | number | null) {
    setLineItems(l => l.map(i => i.id === id ? { ...i, [field]: value } : i));
  }
  function selectProduct(lineId: string, product: ProductService) {
    const taxRate = product.tax_rate ? product.tax_rate.rate : 0;
    setLineItems(l => l.map(i => i.id === lineId ? { ...i, product_id: product.id, description: product.name, unit_price: product.unit_price, tax_rate: taxRate } : i));
  }

  // ── Invoice actions ──────────────────────────────────────────────────────
  async function handleCreate() {
    if (!form.client_id || lineItems.every(l => !l.description)) return;
    setSaving(true);
    const prefix        = getSetting('invoice_prefix') || 'FAC';
    const nextNum       = parseInt(getSetting('next_invoice_number') || '1');
    const invoiceNumber = generateInvoiceNumber(prefix, nextNum);
    const ncf           = await assignNcf(form.ncf_type, companyId);

    const { data: inv } = await db.from('invoices').insert({
      invoice_number: invoiceNumber, ncf, client_id: form.client_id, company_id: companyId,
      issue_date: form.issue_date, due_date: form.due_date || null,
      ncf_type: form.ncf_type, notes: form.notes, terms: form.terms,
      currency: form.currency, is_electronic: form.is_electronic,
      invoice_type: form.invoice_type,
      recurrence_rule: form.invoice_type === 'recurring' ? form.recurrence_rule : null,
      recurrence_end: form.invoice_type === 'recurring' && form.recurrence_end ? form.recurrence_end : null,
      status: 'draft', subtotal: totals.subtotal, tax_amount: totals.tax,
      discount_amount: totals.discount, total: totals.total,
    }).select().maybeSingle();

    if (inv) {
      const items = lineItems.filter(l => l.description.trim()).map((l, idx) => {
        const c = calcLine(l);
        return {
          invoice_id: inv.id, product_id: l.product_id, description: l.description,
          quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate,
          tax_amount: c.tax, discount_percent: l.discount_percent,
          discount_amount: c.disc, line_total: c.total, sort_order: idx,
        };
      });
      await db.from('invoice_items').insert(items);
      await db.from('settings').update({ value: String(nextNum + 1) }).eq('key', 'next_invoice_number');
      if (ncf) {
        const currentMonth = new Date().toISOString().substring(0, 7);
        await db.from('ncf_void_log')
          .update({ reused_by_invoice_id: inv.id })
          .eq('ncf', ncf).eq('ncf_type', form.ncf_type)
          .eq('reuse_allowed', true).is('reused_by_invoice_id', null)
          .eq('issue_month', currentMonth);
      }
      await db.from('notifications').insert({
        company_id: companyId,
        type: 'system', title: 'Factura creada',
        message: `Factura ${invoiceNumber}${ncf ? ` (NCF: ${ncf})` : ''} creada por ${formatCurrency(totals.total)}`,
        invoice_id: inv.id,
      });
    }
    setSaving(false);
    setShowCreate(false);
    refetch();
  }

  async function updateStatus(id: string, status: Invoice['status']) {
    await db.from('invoices').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    refetch();
  }

  async function handleCancel(inv: Invoice) {
    const issueMonth   = inv.issue_date.substring(0, 7);
    const currentMonth = new Date().toISOString().substring(0, 7);
    const reuseAllowed = issueMonth === currentMonth;
    await db.from('invoices').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', inv.id);
    if (inv.ncf) await markNcfVoidLog(inv, reuseAllowed, companyId);
    await db.from('notifications').insert({
      company_id: companyId,
      type: 'system', title: t('invoice_cancelled'),
      message: `${t('invoice_cancelled')}: ${inv.invoice_number}${inv.ncf ? ` (${regionConfig.invoiceNumberLabel}: ${inv.ncf})` : ''}. ${reuseAllowed ? t('ncf_reusable') : t('ncf_lost')}.`,
      invoice_id: inv.id,
    });
    setCancelConfirm(null);
    refetch();
  }

  async function handlePayment() {
    if (!payModal) return;
    await db.from('payment_records').insert({ company_id: companyId, invoice_id: payModal.id, ...payForm });
    const newPaid   = payModal.amount_paid + payForm.amount;
    const newStatus = newPaid >= payModal.total ? 'paid' : 'partial';
    await db.from('invoices').update({
      amount_paid: newPaid, status: newStatus,
      payment_date: newStatus === 'paid' ? payForm.payment_date : undefined,
    }).eq('id', payModal.id);
    await db.from('notifications').insert({
      company_id: companyId,
      type: 'payment_received', title: t('payment_received_notif'),
      message: `${formatCurrency(payForm.amount)} — ${payModal.invoice_number}`,
      invoice_id: payModal.id,
    });
    setPayModal(null);
    refetch();
  }

  // ── NCF sequence actions ─────────────────────────────────────────────────
  async function saveSeq() {
    const payload = {
      ncf_type: seqForm.ncf_type, prefix: seqForm.prefix.trim(),
      from_seq: seqForm.from_seq, to_seq: seqForm.to_seq,
      current_seq: seqForm.current_seq, dgii_auth: seqForm.dgii_auth.trim(),
      expires_at: seqForm.expires_at || null, is_active: true,
      updated_at: new Date().toISOString(),
    };
    if (editingSeq) {
      await db.from('ncf_sequences').update(payload).eq('id', editingSeq.id);
    } else {
      await db.from('ncf_sequences').update({ is_active: false }).eq('ncf_type', seqForm.ncf_type).eq('is_active', true);
      if (companyId) await db.from('ncf_sequences').insert({ ...payload, company_id: companyId });
      else            await db.from('ncf_sequences').insert(payload);
    }
    setSeqModal(false);
    refetchSeq();
  }

  async function toggleSeqActive(seq: NcfSequence) {
    await db.from('ncf_sequences').update({ is_active: !seq.is_active, updated_at: new Date().toISOString() }).eq('id', seq.id);
    refetchSeq();
  }

  // ── e-CF submit ──────────────────────────────────────────────────────────
  async function submitInvoice(invoice: Invoice) {
    setSubmitting(invoice.id);
    let approved    = false;
    let electronicId = '';
    let responseMsg  = '';

    if (providerConfig?.mode === 'own_service' && providerConfig.own_service_url) {
      try {
        const res = await fetch(`${providerConfig.own_service_url}/ecf/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerConfig.own_service_token}` },
          body: JSON.stringify({
            invoice_number: invoice.invoice_number, ncf_type: invoice.ncf_type,
            client_rnc: (invoice.client as Client | undefined)?.rnc ?? '',
            total: invoice.total, tax_amount: invoice.tax_amount,
            issue_date: invoice.issue_date, environment: providerConfig.own_service_environment,
          }),
          signal: AbortSignal.timeout(15000),
        });
        const data = await res.json().catch(() => ({}));
        approved     = res.ok && (data.status === 'approved' || data.approved === true);
        electronicId = data.ecf_id ?? data.id ?? '';
        responseMsg  = data.message ?? (approved ? 'Aprobado' : 'Rechazado');
      } catch (e: unknown) {
        approved    = false;
        responseMsg = e instanceof Error ? e.message : 'Error de conexión';
      }
    } else {
      await new Promise(r => setTimeout(r, 1500));
      approved     = Math.random() > 0.2;
      electronicId = `eCF-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      responseMsg  = approved ? 'Comprobante fiscal electrónico aprobado' : 'Error de validación: datos incompletos';
    }

    const generatedNcf = approved ? (electronicId || invoice.ncf) : invoice.ncf;
    await db.from('invoices').update({
      electronic_status: approved ? 'approved' : 'rejected',
      electronic_id: approved ? (electronicId || generatedNcf) : '',
      electronic_response: {
        status: approved ? 'approved' : 'rejected', message: responseMsg,
        timestamp: new Date().toISOString(), id: approved ? (electronicId || generatedNcf) : null,
        provider: providerConfig?.mode === 'own_service' ? 'own_service' : (providerConfig?.third_party_provider || 'demo'),
      },
      ncf: generatedNcf,
    }).eq('id', invoice.id);

    await db.from('notifications').insert({
      company_id: companyId,
      type: 'electronic',
      title: approved ? 'e-CF Aprobado' : 'e-CF Rechazado',
      message: approved
        ? `Factura ${invoice.invoice_number} aprobada con NCF electrónico`
        : `Factura ${invoice.invoice_number} rechazada: ${responseMsg}`,
      invoice_id: invoice.id,
    });
    setSubmitting(null);
    refetch();
  }

  const ecfStats = {
    total:    electronicInvoices.length,
    pending:  electronicInvoices.filter(i => i.electronic_status === 'pending').length,
    approved: electronicInvoices.filter(i => i.electronic_status === 'approved').length,
    rejected: electronicInvoices.filter(i => i.electronic_status === 'rejected').length,
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('invoices_title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{invoices.length} {t('invoices_total')}</p>
        </div>
        {tab === 'facturas' && canCreate('invoices') && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg whitespace-nowrap shrink-0 transition-colors">
            <Plus size={15} /> {t('new_invoice')}
          </button>
        )}
        {tab === 'secuencias' && canCreate('invoices') && (
          <button onClick={() => { setEditingSeq(null); setSeqForm({ ...emptySeqForm }); setSeqModal(true); }}
            className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            <Plus size={13} /> Nuevo Rango NCF
          </button>
        )}
      </div>

      {/* ── Tab selector ── */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit max-w-full overflow-x-auto">
        {([
          { id: 'facturas',   label: 'Facturas',        icon: FileText },
          { id: 'secuencias', label: 'Secuencias NCF',  icon: Hash },
          { id: 'ecf',        label: 'e-CF',            icon: Zap },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === id ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            <Icon size={14} />
            {label}
            {id === 'ecf' && ecfStats.pending > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">{ecfStats.pending}</span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════
          TAB: FACTURAS
      ════════════════════════════════════════════════════ */}
      {tab === 'facturas' && (
        <>
          {/* Email info banner */}
          <div className="flex items-start gap-2.5 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl px-4 py-3 text-xs text-sky-700 dark:text-sky-300">
            <Info size={14} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">{t('how_to_send_title')}</span>
              {' '}{t('how_to_send_body')}
            </div>
          </div>

          {/* Status filter pills */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'] as FilterStatus[]).map(s => {
              const labels: Record<string, string> = {
                all:       `${t('all')} (${invoices.length})`,
                draft:     `${t('status_draft')} (${statusCounts.draft ?? 0})`,
                sent:      `${t('status_sent')} (${statusCounts.sent ?? 0})`,
                paid:      `${t('status_paid')} (${statusCounts.paid ?? 0})`,
                partial:   `${t('status_partial')} (${statusCounts.partial ?? 0})`,
                overdue:   `${t('status_overdue')} (${statusCounts.overdue ?? 0})`,
                cancelled: `${t('status_cancelled')} (${statusCounts.cancelled ?? 0})`,
              };
              return (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterStatus === s ? 'bg-sky-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                  {labels[s]}
                </button>
              );
            })}
          </div>

          {/* Invoice table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input type="text" placeholder={t('search_invoices')} value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">{t('loading_invoices')}</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <FileText size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('no_invoices')}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('create_first_invoice')}</p>
              </div>
            ) : (
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{t('invoice_number')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{t('client')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden md:table-cell">{t('date')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden lg:table-cell">{t('due_date')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{t('total')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{t('status')}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(inv => {
                      const days = getDaysUntilDue(inv.due_date);
                      return (
                        <tr key={inv.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{inv.invoice_number}</p>
                              {inv.invoice_type === 'recurring' && (
                                <span className="inline-flex items-center gap-0.5 text-xs bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-medium">
                                  <RefreshCw size={9} /> Recurrente
                                </span>
                              )}
                              {inv.is_electronic && <span className="text-xs bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded font-medium">e-CF</span>}
                              {inv.ncf && <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{inv.ncf}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-slate-700 dark:text-slate-200">{(inv.client as Client | undefined)?.name ?? '-'}</p>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(inv.issue_date)}</p>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {inv.due_date ? (
                              <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(inv.due_date)}</p>
                                {days !== null && inv.status !== 'paid' && (
                                  <p className={`text-xs font-medium ${days < 0 ? 'text-red-500' : days <= 3 ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`}>
                                    {days < 0 ? `${t('overdue_days')} ${Math.abs(days)}d` : days === 0 ? t('due_today') : `${days}d ${t('days_remaining')}`}
                                  </p>
                                )}
                              </div>
                            ) : <p className="text-xs text-slate-400 dark:text-slate-500">-</p>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(inv.total)}</p>
                            {inv.amount_paid > 0 && inv.amount_paid < inv.total && (
                              <p className="text-xs text-slate-400 dark:text-slate-500">{t('paid_label')}: {formatCurrency(inv.amount_paid)}</p>
                            )}
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => setViewInvoice(inv)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300" title={t('view_detail')}>
                                <Eye size={14} />
                              </button>
                              <button onClick={() => setPrintInvoice(inv)} className="p-1.5 rounded-lg hover:bg-sky-50 text-slate-400 dark:text-slate-500 hover:text-sky-600" title={t('preview_print')}>
                                <Printer size={14} />
                              </button>
                              {canEdit('invoices') && inv.status === 'draft' && (
                                <button onClick={() => updateStatus(inv.id, 'sent')}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-medium transition-colors">
                                  <Send size={12} />{t('send_invoice')}
                                </button>
                              )}
                              {canEdit('invoices') && ['sent', 'partial', 'overdue'].includes(inv.status) && (
                                <button onClick={() => { setPayModal(inv); setPayForm(f => ({ ...f, amount: inv.total - inv.amount_paid })); }}
                                  className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 dark:text-slate-500 hover:text-emerald-500">
                                  <CreditCard size={14} />
                                </button>
                              )}
                              {canDelete('invoices') && ['draft', 'sent'].includes(inv.status) && (
                                <button onClick={() => setCancelConfirm(inv)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 dark:text-slate-500 hover:text-red-500">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(inv => {
                  const days = getDaysUntilDue(inv.due_date);
                  const canPay = canEdit('invoices') && ['sent', 'partial', 'overdue'].includes(inv.status);
                  return (
                    <div key={inv.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{inv.invoice_number}</p>
                            {inv.invoice_type === 'recurring' && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded font-medium">
                                <RefreshCw size={9} /> Recurrente
                              </span>
                            )}
                            {inv.is_electronic && <span className="text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded font-medium">e-CF</span>}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {(inv.client as Client | undefined)?.name ?? '-'}
                          </p>
                        </div>
                        <StatusBadge status={inv.status} />
                      </div>

                      <div className="flex items-end justify-between gap-3">
                        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5 min-w-0">
                          <p>{formatDate(inv.issue_date)}</p>
                          {inv.due_date && (
                            <p className={days !== null && days < 0 && inv.status !== 'paid' ? 'text-red-500 font-medium' : ''}>
                              {t('due_date')}: {formatDate(inv.due_date)}
                            </p>
                          )}
                          {inv.ncf && <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500 truncate">{inv.ncf}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base font-bold text-slate-800 dark:text-slate-100">{formatCurrency(inv.total)}</p>
                          {inv.amount_paid > 0 && inv.amount_paid < inv.total && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500">{t('paid_label')}: {formatCurrency(inv.amount_paid)}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setViewInvoice(inv)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium whitespace-nowrap">
                          <Eye size={14} /> {t('view_detail')}
                        </button>
                        <button onClick={() => setPrintInvoice(inv)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 text-xs font-medium whitespace-nowrap">
                          <Printer size={14} /> {t('preview_print')}
                        </button>
                        {canEdit('invoices') && inv.status === 'draft' && (
                          <button onClick={() => updateStatus(inv.id, 'sent')}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium whitespace-nowrap">
                            <Send size={14} /> {t('send_invoice')}
                          </button>
                        )}
                        {canPay && (
                          <button onClick={() => { setPayModal(inv); setPayForm(f => ({ ...f, amount: inv.total - inv.amount_paid })); }}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium whitespace-nowrap">
                            <CreditCard size={14} /> {t('register_payment')}
                          </button>
                        )}
                        {canDelete('invoices') && ['draft', 'sent'].includes(inv.status) && (
                          <button onClick={() => setCancelConfirm(inv)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium whitespace-nowrap">
                            <Trash2 size={14} /> {t('cancel')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════
          TAB: SECUENCIAS NCF
      ════════════════════════════════════════════════════ */}
      {tab === 'secuencias' && (
        <div className="space-y-5">
          {/* Active sequences table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Hash size={15} />Rangos NCF Autorizados por DGII
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Cada rango autorizado corresponde a un tipo de comprobante. El sistema asigna automáticamente el próximo número al crear cada factura.
                </p>
              </div>
            </div>

            {seqLoading ? (
              <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">Cargando...</div>
            ) : sequences.length === 0 ? (
              <div className="p-10 text-center text-slate-400 dark:text-slate-500">
                <Hash size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No hay rangos configurados</p>
                <p className="text-xs mt-1">Agrega el rango emitido por la DGII para comenzar a facturar con NCF.</p>
                {canCreate('invoices') && (
                  <button onClick={() => { setEditingSeq(null); setSeqForm({ ...emptySeqForm }); setSeqModal(true); }}
                    className="mt-4 inline-flex items-center gap-1.5 bg-sky-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-sky-700">
                    <Plus size={13} /> Nuevo Rango
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Tipo</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Prefijo</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Rango autorizado</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Próximo #</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Disponibles</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Próximo NCF completo</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Autorización DGII</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Vence</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Estado</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {sequences.map(seq => {
                      const remaining = seq.to_seq - seq.current_seq + 1;
                      const pctUsed   = Math.round(((seq.current_seq - seq.from_seq) / (seq.to_seq - seq.from_seq + 1)) * 100);
                      const low       = remaining <= 50;
                      const nextNcf   = `${seq.prefix}${String(seq.current_seq).padStart(3, '0')}`;
                      return (
                        <tr key={seq.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-700">{seq.ncf_type}</span>
                          </td>
                          <td className="px-5 py-3 font-mono text-slate-700 dark:text-slate-200 text-xs">{seq.prefix}</td>
                          <td className="px-5 py-3 text-right text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {seq.from_seq.toLocaleString()} – {seq.to_seq.toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-slate-800 dark:text-slate-100 font-mono">{seq.current_seq.toLocaleString()}</td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-xs font-semibold ${low ? 'text-amber-600' : 'text-emerald-600'}`}>{remaining.toLocaleString()}</span>
                              <div className="w-16 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full transition-all ${pctUsed > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pctUsed}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <code className="text-xs font-mono font-bold text-sky-700 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded">{nextNcf}</code>
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400 font-mono">{seq.dgii_auth || '-'}</td>
                          <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">{seq.expires_at ? formatDate(seq.expires_at) : '—'}</td>
                          <td className="px-5 py-3">
                            <button onClick={() => toggleSeqActive(seq)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${seq.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                              {seq.is_active ? <><CheckCircle size={10} /> Activo</> : <><Clock size={10} /> Inactivo</>}
                            </button>
                          </td>
                          <td className="px-5 py-3">
                            {canEdit('invoices') && (
                              <button onClick={() => {
                                setEditingSeq(seq);
                                setSeqForm({ ncf_type: seq.ncf_type, prefix: seq.prefix, from_seq: seq.from_seq, to_seq: seq.to_seq, current_seq: seq.current_seq, dgii_auth: seq.dgii_auth, expires_at: seq.expires_at ?? '' });
                                setSeqModal(true);
                              }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                                <Edit2 size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* NCF types legend */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">Tipos de comprobante NCF</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { code: 'B01', label: 'Crédito Fiscal',             desc: 'Para empresas con RNC — deducible de ITBIS' },
                { code: 'B02', label: 'Consumidor Final',           desc: 'Para personas físicas o sin RNC' },
                { code: 'B14', label: 'Régimen Especial',           desc: 'Para contribuyentes de régimen especial' },
                { code: 'B15', label: 'Gubernamental',              desc: 'Para entidades del gobierno' },
              ].map(({ code, label, desc }) => (
                <div key={code} className="flex items-start gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-700 shrink-0 mt-0.5">{code}</span>
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{label}</p>
                    <p className="text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Void log */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-500" />Registro de NCF Anulados
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Historial de comprobantes cancelados. Si la cancelación fue dentro del mismo mes, el NCF puede reutilizarse en la próxima factura del mismo tipo.
              </p>
            </div>
            {voidLoading ? (
              <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">Cargando...</div>
            ) : voidLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">Sin NCF anulados registrados</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Fecha Anulación</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">No. Factura</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">NCF</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Tipo</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Mes Emisión</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Estado</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voidLogs.map(log => (
                      <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">{new Date(log.cancelled_at).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="px-5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-200">{log.invoice_number}</td>
                        <td className="px-5 py-3 text-xs font-mono text-slate-700 dark:text-slate-200">{log.ncf}</td>
                        <td className="px-5 py-3"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-700">{log.ncf_type}</span></td>
                        <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">{log.issue_month}</td>
                        <td className="px-5 py-3">
                          {log.reused_by_invoice_id ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium"><CheckCircle size={10} /> Reutilizado</span>
                          ) : log.reuse_allowed ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium"><CheckCircle size={10} /> Disponible</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium"><AlertTriangle size={10} /> Perdido</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-400 dark:text-slate-500">{log.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          TAB: e-CF
      ════════════════════════════════════════════════════ */}
      {tab === 'ecf' && (
        <div className="space-y-5">
          {/* e-CF module toggle */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Módulo de Facturación Electrónica</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {electronicEnabled ? 'Activado — los e-CFs se enviarán a la DGII según la configuración del proveedor.' : 'Desactivado — activa para poder enviar comprobantes fiscales electrónicos.'}
              </p>
            </div>
            <button
              onClick={() => electronicFlag && toggle(electronicFlag.id, !electronicEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${electronicEnabled ? 'bg-sky-600' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${electronicEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total e-CF',  value: ecfStats.total,    color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200',   icon: FileCheck },
              { label: 'Pendientes',  value: ecfStats.pending,  color: 'bg-amber-100 text-amber-700',   icon: Clock },
              { label: 'Aprobadas',   value: ecfStats.approved, color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
              { label: 'Rechazadas',  value: ecfStats.rejected, color: 'bg-red-100 text-red-700',       icon: XCircle },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon size={16} />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* e-CF table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Facturas Electrónicas</h3>
              <div className="flex items-center gap-3">
                {providerConfig?.mode === 'own_service' && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full">
                    <Server size={11} /> Servicio Propio
                  </span>
                )}
                <span className="text-xs text-slate-400 dark:text-slate-500">{electronicInvoices.length} facturas</span>
              </div>
            </div>
            {electronicInvoices.length === 0 ? (
              <div className="p-12 text-center">
                <Zap size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No hay facturas electrónicas</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Crea facturas marcando la opción "Factura Electrónica" al crearlas</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Factura</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Cliente</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden md:table-cell">Fecha</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Total</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Estado</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">e-CF</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden lg:table-cell">NCF / ID</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {electronicInvoices.map(inv => (
                      <tr key={inv.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{inv.invoice_number}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{inv.ncf_type}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-600 dark:text-slate-400">{(inv.client as Client | undefined)?.name ?? '-'}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(inv.issue_date)}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(inv.total)}</p>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getElectronicStatusColor(inv.electronic_status)}`}>
                            {getElectronicStatusLabel(inv.electronic_status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{inv.ncf || inv.electronic_id || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {inv.electronic_status === 'pending' && electronicEnabled && canEdit('invoices') && (
                            <button onClick={() => submitInvoice(inv)} disabled={submitting === inv.id}
                              className="flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg transition-colors ml-auto disabled:opacity-50">
                              {submitting === inv.id ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                              {submitting === inv.id ? 'Enviando...' : 'Enviar'}
                            </button>
                          )}
                          {inv.electronic_status === 'rejected' && canEdit('invoices') && (
                            <button onClick={() => submitInvoice(inv)} disabled={submitting === inv.id}
                              className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors ml-auto disabled:opacity-50">
                              {submitting === inv.id ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                              Reenviar
                            </button>
                          )}
                          {inv.electronic_status === 'approved' && (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium ml-auto">
                              <CheckCircle2 size={12} /> Aprobada
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════ */}

      {/* Create invoice */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={t('new_invoice')} size="4xl">
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('client')} *</label>
              <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                <option value="">{t('client')}...</option>
                {clients.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('invoice_type_label')}</label>
              <select value={form.ncf_type} onChange={e => setForm(f => ({ ...f, ncf_type: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                {regionConfig.invoiceTypes.map(it => (
                  <option key={it.value} value={it.value}>{it.label[lang as keyof typeof it.label] ?? it.label.es}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('issue_date')}</label>
              <input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('due_date')}</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">{t('line_items')}</label>
              <button onClick={addLine} className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1 font-medium">
                <Plus size={12} /> {t('add_line')}
              </button>
            </div>
            <div className="hidden md:block border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500 dark:text-slate-400">{t('description')}</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-500 dark:text-slate-400 w-20">{t('quantity')}</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-500 dark:text-slate-400 w-28">{t('price')}</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-500 dark:text-slate-400 w-24">{regionConfig.taxLabel} %</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-500 dark:text-slate-400 w-24">{t('discount_pct')}</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-500 dark:text-slate-400 w-28">{t('total')}</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map(item => {
                    const c = calcLine(item);
                    return (
                      <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2">
                          <div className="space-y-1">
                            <select value={item.product_id ?? ''} onChange={e => {
                              const p = products.find(x => x.id === e.target.value);
                              if (p) selectProduct(item.id, p);
                              else updateLine(item.id, 'product_id', e.target.value || null);
                            }} className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                              <option value="">Personalizado...</option>
                              {products.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <input type="text" value={item.description} onChange={e => updateLine(item.id, 'description', e.target.value)}
                              placeholder="Descripción del ítem"
                              className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
                          </div>
                        </td>
                        <td className="px-3 py-2"><input type="number" value={item.quantity} onChange={e => updateLine(item.id, 'quantity', parseFloat(e.target.value) || 0)} min={0} step={0.001} className="w-full text-right border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" /></td>
                        <td className="px-3 py-2"><input type="number" value={item.unit_price} onChange={e => updateLine(item.id, 'unit_price', parseFloat(e.target.value) || 0)} min={0} step={0.01} className="w-full text-right border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" /></td>
                        <td className="px-3 py-2"><input type="number" value={item.tax_rate} onChange={e => updateLine(item.id, 'tax_rate', parseFloat(e.target.value) || 0)} min={0} max={100} className="w-full text-right border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" /></td>
                        <td className="px-3 py-2"><input type="number" value={item.discount_percent} onChange={e => updateLine(item.id, 'discount_percent', parseFloat(e.target.value) || 0)} min={0} max={100} className="w-full text-right border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" /></td>
                        <td className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-200">{formatCurrency(c.total)}</td>
                        <td className="px-3 py-2">
                          {lineItems.length > 1 && (
                            <button onClick={() => removeLine(item.id)} className="p-1 rounded hover:bg-red-50 text-slate-300 dark:text-slate-600 hover:text-red-400">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile line-item editor */}
            <div className="md:hidden space-y-3">
              {lineItems.map(item => {
                const c = calcLine(item);
                return (
                  <div key={item.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <select value={item.product_id ?? ''} onChange={e => {
                        const p = products.find(x => x.id === e.target.value);
                        if (p) selectProduct(item.id, p);
                        else updateLine(item.id, 'product_id', e.target.value || null);
                      }} className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                        <option value="">Personalizado...</option>
                        {products.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {lineItems.length > 1 && (
                        <button onClick={() => removeLine(item.id)} aria-label={t('delete')}
                          className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 shrink-0">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <input type="text" value={item.description} onChange={e => updateLine(item.id, 'description', e.target.value)}
                      placeholder={t('description')}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">{t('quantity')}</span>
                        <input type="number" value={item.quantity} onChange={e => updateLine(item.id, 'quantity', parseFloat(e.target.value) || 0)} min={0} step={0.001}
                          className="w-full text-right border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                      </label>
                      <label className="block">
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">{t('price')}</span>
                        <input type="number" value={item.unit_price} onChange={e => updateLine(item.id, 'unit_price', parseFloat(e.target.value) || 0)} min={0} step={0.01}
                          className="w-full text-right border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                      </label>
                      <label className="block">
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">{regionConfig.taxLabel} %</span>
                        <input type="number" value={item.tax_rate} onChange={e => updateLine(item.id, 'tax_rate', parseFloat(e.target.value) || 0)} min={0} max={100}
                          className="w-full text-right border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                      </label>
                      <label className="block">
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">{t('discount_pct')}</span>
                        <input type="number" value={item.discount_percent} onChange={e => updateLine(item.id, 'discount_percent', parseFloat(e.target.value) || 0)} min={0} max={100}
                          className="w-full text-right border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                      </label>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <span className="text-slate-500 dark:text-slate-400">{t('total')}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(c.total)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>{t('subtotal')}</span><span>{formatCurrency(totals.subtotal)}</span></div>
              {totals.discount > 0 && <div className="flex justify-between text-red-500"><span>{t('discount')}</span><span>-{formatCurrency(totals.discount)}</span></div>}
              <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>{regionConfig.taxLabel}</span><span>{formatCurrency(totals.tax)}</span></div>
              <div className="flex justify-between font-semibold text-slate-800 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-1.5"><span>{t('total')}</span><span>{formatCurrency(totals.total)}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('notes')}</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" placeholder={t('notes_placeholder')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('terms')}</label>
              <textarea value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))}
                rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" placeholder={t('terms_placeholder')} />
            </div>
          </div>

          {/* Invoice type toggle */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2"><Repeat size={13} />{t('invoice_type')}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setForm(f => ({ ...f, invoice_type: 'one_time' }))}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg border-2 transition-colors ${form.invoice_type === 'one_time' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                {t('invoice_type_one_time')}
              </button>
              <button type="button" onClick={() => setForm(f => ({ ...f, invoice_type: 'recurring' }))}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg border-2 transition-colors flex items-center justify-center gap-2 ${form.invoice_type === 'recurring' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <RefreshCw size={13} /> {t('invoice_type_recurring')}
              </button>
            </div>
            {form.invoice_type === 'recurring' && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('recurrence_frequency')}</label>
                  <select value={form.recurrence_rule ?? 'monthly'} onChange={e => setForm(f => ({ ...f, recurrence_rule: e.target.value as Invoice['recurrence_rule'] }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                    <option value="monthly">{t('freq_monthly')}</option>
                    <option value="bimonthly">{t('freq_bimonthly')}</option>
                    <option value="quarterly">{t('freq_quarterly')}</option>
                    <option value="yearly">{t('freq_yearly')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('recurrence_end')} <span className="text-slate-400 dark:text-slate-500 font-normal">({t('optional')})</span></label>
                  <input type="date" value={form.recurrence_end} onChange={e => setForm(f => ({ ...f, recurrence_end: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="electronic" checked={form.is_electronic} onChange={e => setForm(f => ({ ...f, is_electronic: e.target.checked }))} className="w-4 h-4 text-sky-600 rounded" />
            <label htmlFor="electronic" className="text-sm text-slate-600 dark:text-slate-400">{t('electronic_invoice_label')}</label>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">{t('cancel')}</button>
            <button onClick={handleCreate} disabled={saving || !form.client_id}
              className="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
              {saving ? <><RefreshCw size={13} className="animate-spin" /> {t('saving')}</> : t('create_invoice')}
            </button>
          </div>
        </div>
      </Modal>

      {/* View invoice */}
      {viewInvoice && (
        <Modal isOpen={!!viewInvoice} onClose={() => setViewInvoice(null)} title={`Factura ${viewInvoice.invoice_number}`} size="xl">
          <InvoiceDetail invoice={viewInvoice} />
        </Modal>
      )}

      {/* Print preview */}
      {printInvoice && <InvoiceTemplate invoice={printInvoice} onClose={() => setPrintInvoice(null)} />}

      {/* Payment */}
      <Modal isOpen={!!payModal} onClose={() => setPayModal(null)} title={t('register_payment')} size="md">
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('invoice')}: <span className="font-medium text-slate-700 dark:text-slate-200">{payModal?.invoice_number}</span></p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('balance_due')}: <span className="font-semibold text-red-600">{formatCurrency((payModal?.total ?? 0) - (payModal?.amount_paid ?? 0))}</span></p>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('amount')} *</label>
            <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" min={0} step={0.01} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('payment_method')}</label>
              <select value={payForm.payment_method} onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value as typeof payForm.payment_method }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                <option value="transfer">{t('method_transfer')}</option>
                <option value="cash">{t('method_cash')}</option>
                <option value="check">{t('method_check')}</option>
                <option value="card">{t('method_card')}</option>
                <option value="other">{t('method_other')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('date')}</label>
              <input type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('reference')}</label>
            <input type="text" value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" placeholder={t('reference_placeholder')} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setPayModal(null)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">{t('cancel')}</button>
            <button onClick={handlePayment} disabled={!payForm.amount}
              className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50">
              {t('register_payment')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel / void confirm */}
      <Modal isOpen={!!cancelConfirm} onClose={() => setCancelConfirm(null)} title={t('void_invoice_title')} size="sm">
        {cancelConfirm && (() => {
          const issueMonth   = cancelConfirm.issue_date.substring(0, 7);
          const currentMonth = new Date().toISOString().substring(0, 7);
          const sameMonth    = issueMonth === currentMonth;
          return (
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('void_invoice_confirm')} <span className="font-semibold text-slate-800 dark:text-slate-100">{cancelConfirm.invoice_number}</span>?
              </p>
              {cancelConfirm.ncf && (
                <div className={`rounded-lg px-4 py-3 text-xs ${sameMonth ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'}`}>
                  <p className="font-semibold mb-0.5">NCF: {cancelConfirm.ncf}</p>
                  {sameMonth ? t('ncf_void_reusable') : t('ncf_void_lost')}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => setCancelConfirm(null)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">{t('void_invoice_no')}</button>
                <button onClick={() => handleCancel(cancelConfirm)} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg">
                  {t('void_invoice_yes')}
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* NCF Sequence modal */}
      <Modal isOpen={seqModal} onClose={() => setSeqModal(false)} title={editingSeq ? 'Editar Rango NCF' : 'Nuevo Rango NCF'} size="lg">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Tipo de Comprobante</label>
              <select value={seqForm.ncf_type} onChange={e => setSeqForm(f => ({ ...f, ncf_type: e.target.value as NcfSequence['ncf_type'] }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                <option value="B01">B01 – Crédito Fiscal</option>
                <option value="B02">B02 – Consumidor Final</option>
                <option value="B14">B14 – Régimen Especial</option>
                <option value="B15">B15 – Gubernamental</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Prefijo NCF <span className="text-slate-400 dark:text-slate-500 font-normal">(ej: B0100001)</span></label>
              <input type="text" value={seqForm.prefix} onChange={e => setSeqForm(f => ({ ...f, prefix: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                placeholder="B0100001" />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">NCF final: prefijo + número, ej: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">B0100001325</code></p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Desde (número inicial)</label>
              <input type="number" value={seqForm.from_seq} onChange={e => setSeqForm(f => ({ ...f, from_seq: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" min={1} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Hasta (número final)</label>
              <input type="number" value={seqForm.to_seq} onChange={e => setSeqForm(f => ({ ...f, to_seq: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" min={1} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Próximo número a usar</label>
              <input type="number" value={seqForm.current_seq} onChange={e => setSeqForm(f => ({ ...f, current_seq: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" min={1} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">No. Autorización DGII</label>
              <input type="text" value={seqForm.dgii_auth} onChange={e => setSeqForm(f => ({ ...f, dgii_auth: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                placeholder="2003173285" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Fecha de Vencimiento <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span></label>
              <input type="date" value={seqForm.expires_at} onChange={e => setSeqForm(f => ({ ...f, expires_at: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
            </div>
          </div>
          {seqForm.prefix && seqForm.current_seq > 0 && (
            <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg px-4 py-3 text-xs text-sky-700 dark:text-sky-300">
              El próximo NCF asignado será: <code className="font-mono font-bold text-sky-800 dark:text-sky-200 bg-sky-100 dark:bg-sky-900/40 px-1.5 py-0.5 rounded">{seqForm.prefix}{String(seqForm.current_seq).padStart(3, '0')}</code>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setSeqModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancelar</button>
            <button onClick={saveSeq} disabled={!seqForm.prefix.trim() || !seqForm.dgii_auth.trim()}
              className="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-50">
              {editingSeq ? 'Actualizar' : 'Crear Rango'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const { t, formatCurrency, formatDate, regionConfig } = useI18n();
  const [items, setItems] = useState<InvoiceItem[]>([]);
  useEffect(() => {
    db.from('invoice_items').select('*').eq('invoice_id', invoice.id).order('sort_order').then(({ data }) => setItems(data ?? []));
  }, [invoice.id]);

  return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-400 dark:text-slate-500">{t('client')}</p>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{(invoice.client as Client | undefined)?.name ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 dark:text-slate-500">{t('status')}</p>
          <StatusBadge status={invoice.status} />
        </div>
        <div>
          <p className="text-xs text-slate-400 dark:text-slate-500">{t('issue_date')}</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{formatDate(invoice.issue_date)}</p>
        </div>
        {invoice.due_date && (
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">{t('due_date')}</p>
            <p className="text-sm text-slate-700 dark:text-slate-200">{formatDate(invoice.due_date)}</p>
          </div>
        )}
        {invoice.ncf && (
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">{regionConfig.invoiceNumberLabel}</p>
            <p className="text-sm font-mono text-slate-700 dark:text-slate-200">{invoice.ncf}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-slate-400 dark:text-slate-500">Tipo</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">{invoice.ncf_type}</p>
        </div>
      </div>
      {items.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-slate-500 dark:text-slate-400">{t('description')}</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-500 dark:text-slate-400">{t('quantity')}</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-500 dark:text-slate-400">{t('price')}</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-500 dark:text-slate-400">{t('total')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{item.description}</td>
                  <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{item.quantity}</td>
                  <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{formatCurrency(item.unit_price)}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-200">{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end">
        <div className="w-52 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>{t('subtotal')}</span><span>{formatCurrency(invoice.subtotal)}</span></div>
          {invoice.discount_amount > 0 && <div className="flex justify-between text-red-500"><span>{t('discount')}</span><span>-{formatCurrency(invoice.discount_amount)}</span></div>}
          <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>{regionConfig.taxLabel}</span><span>{formatCurrency(invoice.tax_amount)}</span></div>
          <div className="flex justify-between font-semibold text-slate-800 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-1.5"><span>{t('total')}</span><span>{formatCurrency(invoice.total)}</span></div>
          {invoice.amount_paid > 0 && <div className="flex justify-between text-emerald-600"><span>{t('paid_label')}</span><span>{formatCurrency(invoice.amount_paid)}</span></div>}
        </div>
      </div>
      {invoice.notes && (
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('notes')}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}
