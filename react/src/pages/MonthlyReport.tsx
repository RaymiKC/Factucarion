import { useState, useMemo } from 'react';
import { FileDown, Calendar, Filter, ChevronDown, Building2, Printer } from 'lucide-react';
import { db } from '../lib/db';
import { useCompany } from '../lib/company';
import { useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportInvoice {
  id: string;
  invoice_number: string;
  ncf: string | null;
  ncf_type: string | null;
  issue_date: string;
  due_date: string | null;
  payment_date: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  amount_paid: number;
  currency: string;
  exchange_rate: number;
  notes: string | null;
  client_id: string;
  client_name: string;
  client_rnc: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, dec = 2) {
  return n.toLocaleString('es-DO', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtDate(d: string | null) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function monthLabel(key: string) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });
}

function getLast12Months(): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

// ── Data hook ─────────────────────────────────────────────────────────────────

function useMonthlyReport(companyId: string | undefined, month: string) {
  const [invoices, setInvoices] = useState<ReportInvoice[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!companyId || !month) return;
    setLoading(true);

    const from = `${month}-01`;
    // last day of month
    const [y, m] = month.split('-').map(Number);
    const to = new Date(y, m, 0).toISOString().split('T')[0];

    const { data } = await db
      .from('invoices')
      .select('*, clients(id, name, rnc)')
      .eq('company_id', companyId)
      .gte('issue_date', from)
      .lte('issue_date', to)
      .neq('status', 'cancelled')
      .neq('status', 'draft')
      .order('issue_date');

    const rows: ReportInvoice[] = (data ?? []).map((inv: Record<string, unknown>) => {
      const client = (inv.clients ?? {}) as Record<string, unknown>;
      return {
        id: inv.id as string,
        invoice_number: inv.invoice_number as string,
        ncf: inv.ncf as string | null,
        ncf_type: inv.ncf_type as string | null,
        issue_date: inv.issue_date as string,
        due_date: inv.due_date as string | null,
        payment_date: inv.payment_date as string | null,
        subtotal: Number(inv.subtotal ?? 0),
        tax_amount: Number(inv.tax_amount ?? 0),
        discount_amount: Number(inv.discount_amount ?? 0),
        total: Number(inv.total ?? 0),
        amount_paid: Number(inv.amount_paid ?? 0),
        currency: (inv.currency as string) ?? 'DOP',
        exchange_rate: Number(inv.exchange_rate ?? 1),
        notes: inv.notes as string | null,
        client_id: client.id as string,
        client_name: (client.name as string) ?? '—',
        client_rnc: (client.rnc as string | null) ?? null,
      };
    });

    setInvoices(rows);
    setLoading(false);
  }, [companyId, month]);

  useEffect(() => { fetch(); }, [fetch]);
  return { invoices, loading, refetch: fetch };
}

// ── Excel export (pure JS, no library needed) ─────────────────────────────────

function exportToCSV(rows: ReportInvoice[], month: string, companyName: string) {
  const headers = [
    'CLIENTES', 'RNC', 'MENSUALIDAD EN USD', 'TASA', 'DESCUENTO',
    'SUB TOTAL', 'ITBIS', 'TOTAL A FACTURAR', 'TOTAL EN USD',
    'MONTO RECIBIDO', 'FECHA PAGO', 'NOTA', 'FAC - CLIENTE - NCF',
  ];

  const escape = (v: string | number | null) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines: string[] = [];

  // Company + month header rows
  lines.push(escape(`REPORTE MENSUAL — ${companyName}`));
  lines.push(escape(monthLabel(month).toUpperCase()));
  lines.push('');

  // Column headers
  lines.push(headers.map(escape).join(','));

  // Data rows
  rows.forEach(r => {
    const usdAmount = r.currency === 'USD' ? r.subtotal : r.subtotal / (r.exchange_rate || 1);
    const totalUsd = r.currency === 'USD' ? r.total : r.total / (r.exchange_rate || 1);
    const fac = [r.invoice_number, r.client_name, r.ncf].filter(Boolean).join(' - ');

    const cols = [
      r.client_name,
      r.client_rnc ?? '',
      fmt(usdAmount),
      fmt(r.exchange_rate),
      fmt(r.discount_amount),
      fmt(r.subtotal),
      fmt(r.tax_amount),
      fmt(r.total),
      fmt(totalUsd),
      fmt(r.amount_paid),
      r.payment_date ? fmtDate(r.payment_date) : '',
      r.notes ?? '',
      fac,
    ];

    lines.push(cols.map(escape).join(','));
  });

  // Totals row
  const totals = {
    subtotal: rows.reduce((s, r) => s + r.subtotal, 0),
    tax: rows.reduce((s, r) => s + r.tax_amount, 0),
    discount: rows.reduce((s, r) => s + r.discount_amount, 0),
    total: rows.reduce((s, r) => s + r.total, 0),
    paid: rows.reduce((s, r) => s + r.amount_paid, 0),
    usd: rows.reduce((s, r) => s + (r.currency === 'USD' ? r.total : r.total / (r.exchange_rate || 1)), 0),
  };

  lines.push([
    'TOTALES', '', '', '', fmt(totals.discount),
    fmt(totals.subtotal), fmt(totals.tax), fmt(totals.total), fmt(totals.usd),
    fmt(totals.paid), '', '', '',
  ].map(escape).join(','));

  // BOM for Excel UTF-8
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte_${month}_${companyName.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  paid:     'bg-emerald-100 text-emerald-700',
  partial:  'bg-amber-100 text-amber-700',
  sent:     'bg-sky-100 text-sky-700',
  overdue:  'bg-red-100 text-red-700',
  draft:    'bg-slate-100 text-slate-600',
};

const STATUS_LABELS: Record<string, string> = {
  paid: 'Pagada', partial: 'Parcial', sent: 'Enviada', overdue: 'Vencida', draft: 'Borrador',
};

// ── Main component ────────────────────────────────────────────────────────────

interface MonthlyReportProps {
  companyId?: string;
}

export default function MonthlyReport({ companyId }: MonthlyReportProps) {
  const { currentCompany, allCompanies } = useCompany();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>(companyId ?? currentCompany?.id);
  const months = getLast12Months();

  const effectiveCompanyId = selectedCompanyId ?? companyId ?? currentCompany?.id;
  const companyObj = allCompanies.find(c => c.id === effectiveCompanyId) ?? currentCompany;

  const { invoices, loading } = useMonthlyReport(effectiveCompanyId, selectedMonth);

  const totals = useMemo(() => ({
    subtotal:   invoices.reduce((s, r) => s + r.subtotal, 0),
    tax:        invoices.reduce((s, r) => s + r.tax_amount, 0),
    discount:   invoices.reduce((s, r) => s + r.discount_amount, 0),
    total:      invoices.reduce((s, r) => s + r.total, 0),
    paid:       invoices.reduce((s, r) => s + r.amount_paid, 0),
    balance:    invoices.reduce((s, r) => s + (r.total - r.amount_paid), 0),
    usd:        invoices.reduce((s, r) => s + (r.currency === 'USD' ? r.total : r.total / (r.exchange_rate || 1)), 0),
    usdSub:     invoices.reduce((s, r) => s + (r.currency === 'USD' ? r.subtotal : r.subtotal / (r.exchange_rate || 1)), 0),
  }), [invoices]);

  const inputCls = 'px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 bg-white';
  const thCls = 'px-3 py-3 text-left text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap border-b-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60';
  const tdCls = 'px-3 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap';
  const tdNumCls = `${tdCls} text-right font-mono`;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Reporte Mensual</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Facturación por período con exportación a Excel</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Company selector (admin) */}
          {allCompanies.length > 1 && (
            <div className="relative">
              <Building2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={selectedCompanyId ?? ''}
                onChange={e => setSelectedCompanyId(e.target.value || undefined)}
                className={`${inputCls} pl-8 pr-8`}
              >
                {allCompanies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          {/* Month picker */}
          <div className="relative">
            <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className={`${inputCls} pl-8 pr-8`}
            >
              {months.map(m => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>
          {/* Export */}
          <button
            onClick={() => exportToCSV(invoices, selectedMonth, companyObj?.name ?? 'Empresa')}
            disabled={invoices.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <FileDown size={15} /> Exportar Excel
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Printer size={15} /> Imprimir
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Facturas', value: String(invoices.length), color: 'bg-sky-500' },
          { label: 'Sub Total', value: `RD$ ${fmt(totals.subtotal)}`, color: 'bg-slate-500' },
          { label: 'ITBIS', value: `RD$ ${fmt(totals.tax)}`, color: 'bg-amber-500' },
          { label: 'Total Facturado', value: `RD$ ${fmt(totals.total)}`, color: 'bg-emerald-600' },
          { label: 'Monto Recibido', value: `RD$ ${fmt(totals.paid)}`, color: 'bg-teal-600' },
          { label: 'Balance Pendiente', value: `RD$ ${fmt(totals.balance)}`, color: 'bg-rose-500' },
          { label: 'Total USD', value: `$ ${fmt(totals.usd)}`, color: 'bg-blue-600' },
          { label: 'Descuentos', value: `RD$ ${fmt(totals.discount)}`, color: 'bg-orange-500' },
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className={`w-7 h-7 ${card.color} rounded-lg flex items-center justify-center mb-2`}>
              <div className="w-2 h-2 bg-white/80 rounded-full" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide">{card.label}</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5 font-mono">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Report period title */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
          {companyObj?.name} — {monthLabel(selectedMonth).toUpperCase()}
        </span>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400 dark:text-slate-500">
            <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Cargando reporte...
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center">
            <Filter size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No hay facturas en este período</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Selecciona otro mes o empresa</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" id="monthly-report-table">
              <thead>
                <tr>
                  <th className={thCls}>CLIENTES</th>
                  <th className={thCls}>RNC</th>
                  <th className={`${thCls} text-right`}>MENSUALIDAD USD</th>
                  <th className={`${thCls} text-right`}>TASA</th>
                  <th className={`${thCls} text-right`}>DESCUENTO</th>
                  <th className={`${thCls} text-right`}>SUB TOTAL</th>
                  <th className={`${thCls} text-right`}>ITBIS</th>
                  <th className={`${thCls} text-right`}>TOTAL A FACTURAR</th>
                  <th className={`${thCls} text-right`}>TOTAL USD</th>
                  <th className={`${thCls} text-right`}>MONTO RECIBIDO</th>
                  <th className={thCls}>FECHA PAGO</th>
                  <th className={thCls}>NOTA</th>
                  <th className={thCls}>FAC - CLIENTE - NCF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoices.map((row, idx) => {
                  const usdSub  = row.currency === 'USD' ? row.subtotal : row.subtotal / (row.exchange_rate || 1);
                  const totalUsd = row.currency === 'USD' ? row.total : row.total / (row.exchange_rate || 1);
                  const fac = [row.invoice_number, row.client_name, row.ncf].filter(Boolean).join(' - ');
                  const balance = row.total - row.amount_paid;
                  return (
                    <tr key={row.id} className={`${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/30'} hover:bg-sky-50/40 dark:hover:bg-sky-900/10 transition-colors`}>
                      <td className={tdCls}>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{row.client_name}</span>
                      </td>
                      <td className={`${tdCls} text-slate-500 dark:text-slate-400 font-mono text-xs`}>{row.client_rnc ?? '—'}</td>
                      <td className={tdNumCls}>{fmt(usdSub)}</td>
                      <td className={tdNumCls}>{fmt(row.exchange_rate, 2)}</td>
                      <td className={`${tdNumCls} ${row.discount_amount > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                        {row.discount_amount > 0 ? `(${fmt(row.discount_amount)})` : '—'}
                      </td>
                      <td className={tdNumCls}>{fmt(row.subtotal)}</td>
                      <td className={tdNumCls}>{fmt(row.tax_amount)}</td>
                      <td className={`${tdNumCls} font-semibold text-slate-800 dark:text-slate-100`}>{fmt(row.total)}</td>
                      <td className={tdNumCls}>{fmt(totalUsd)}</td>
                      <td className={`${tdNumCls} ${balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {fmt(row.amount_paid)}
                        {balance > 0 && <span className="text-[10px] text-rose-500 ml-1">({fmt(balance)} pend.)</span>}
                      </td>
                      <td className={`${tdCls} text-xs`}>{row.payment_date ? fmtDate(row.payment_date) : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                      <td className={`${tdCls} text-xs max-w-[140px] truncate`} title={row.notes ?? ''}>{row.notes ?? <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                      <td className={`${tdCls} text-xs font-mono text-slate-500 dark:text-slate-400 max-w-[180px] truncate`} title={fac}>{fac}</td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals footer */}
              <tfoot>
                <tr className="bg-slate-800 dark:bg-slate-950 text-white">
                  <td className="px-3 py-3 text-sm font-bold" colSpan={2}>TOTALES ({invoices.length} facturas)</td>
                  <td className="px-3 py-3 text-right text-sm font-bold font-mono">{fmt(totals.usdSub)}</td>
                  <td className="px-3 py-3 text-right text-sm text-slate-400">—</td>
                  <td className="px-3 py-3 text-right text-sm font-bold font-mono text-rose-300">({fmt(totals.discount)})</td>
                  <td className="px-3 py-3 text-right text-sm font-bold font-mono">{fmt(totals.subtotal)}</td>
                  <td className="px-3 py-3 text-right text-sm font-bold font-mono">{fmt(totals.tax)}</td>
                  <td className="px-3 py-3 text-right text-sm font-bold font-mono">{fmt(totals.total)}</td>
                  <td className="px-3 py-3 text-right text-sm font-bold font-mono">{fmt(totals.usd)}</td>
                  <td className="px-3 py-3 text-right text-sm font-bold font-mono text-emerald-300">{fmt(totals.paid)}</td>
                  <td className="px-3 py-3" colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #monthly-report-table { display: table !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
