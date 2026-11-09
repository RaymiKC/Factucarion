import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, DollarSign, BarChart2, PieChart, Plus, Trash2, CreditCard as Edit2, X, Check, Filter, Calendar, ArrowUpRight, ArrowDownRight, Target, Activity, Briefcase, ShoppingCart, Building2 } from 'lucide-react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import { useInvoices } from '../lib/hooks';
import { useCompany } from '../lib/company';
import { useI18n } from '../lib/i18n';

// ── Types ────────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  vendor: string | null;
  created_at: string;
}

type ExpenseForm = Omit<Expense, 'id' | 'created_at'>;

const EXPENSE_CATEGORIES = [
  'Nómina', 'Marketing', 'Alquiler', 'Servicios', 'Tecnología',
  'Transporte', 'Suministros', 'Impuestos', 'Seguros', 'Otros',
];

const CATEGORY_COLORS: Record<string, string> = {
  'Nómina':       'bg-sky-500',
  'Marketing':    'bg-amber-500',
  'Alquiler':     'bg-rose-500',
  'Servicios':    'bg-emerald-500',
  'Tecnología':   'bg-violet-500',
  'Transporte':   'bg-orange-500',
  'Suministros':  'bg-teal-500',
  'Impuestos':    'bg-red-600',
  'Seguros':      'bg-blue-500',
  'Otros':        'bg-slate-400',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function monthKey(dateStr: string) {
  return dateStr.substring(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('es-DO', { month: 'short', year: '2-digit' });
}

function last6Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function pct(a: number, b: number) {
  if (b === 0) return 0;
  return ((a - b) / b) * 100;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

function useExpenses(companyId?: string) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = db.from('expenses').select('*').order('date', { ascending: false });
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    const { data } = await query;
    setExpenses(data ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = useCallback(async (form: ExpenseForm) => {
    if (!user) return;
    await db.from('expenses').insert({ ...form, user_id: user.id, ...(companyId ? { company_id: companyId } : {}) });
    fetch();
  }, [fetch, companyId, user]);

  const update = useCallback(async (id: string, form: Partial<ExpenseForm>) => {
    await db.from('expenses').update({ ...form, updated_at: new Date().toISOString() }).eq('id', id);
    fetch();
  }, [fetch]);

  const remove = useCallback(async (id: string) => {
    await db.from('expenses').delete().eq('id', id);
    fetch();
  }, [fetch]);

  return { expenses, loading, refetch: fetch, add, update, remove };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color, trend, trendLabel,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string;
  trend?: number; trendLabel?: string;
}) {
  const up = (trend ?? 0) >= 0;
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
        <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center`}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-none">{value}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
          {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          <span>{Math.abs(trend).toFixed(1)}%</span>
          {trendLabel && <span className="text-slate-400 dark:text-slate-500 font-normal">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}

function BarChart({ data, maxVal, formatCurrency, incomeLbl, expensesLbl }: { data: { label: string; revenue: number; expenses: number }[]; maxVal: number; formatCurrency: (n: number) => string; incomeLbl: string; expensesLbl: string }) {
  return (
    <div className="flex items-end gap-2 h-40 w-full">
      {data.map(({ label, revenue, expenses }) => {
        const rH = maxVal > 0 ? (revenue / maxVal) * 100 : 0;
        const eH = maxVal > 0 ? (expenses / maxVal) * 100 : 0;
        return (
          <div key={label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="w-full flex items-end gap-0.5 h-32">
              <div
                className="flex-1 bg-sky-400 rounded-t transition-all duration-500"
                style={{ height: `${rH}%` }}
                title={`${incomeLbl}: ${formatCurrency(revenue)}`}
              />
              <div
                className="flex-1 bg-rose-400 rounded-t transition-all duration-500"
                style={{ height: `${eH}%` }}
                title={`${expensesLbl}: ${formatCurrency(expenses)}`}
              />
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate w-full text-center">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ slices }: { slices: { label: string; pct: number; color: string }[] }) {
  let cumulative = 0;
  const r = 40;
  const cx = 50;
  const cy = 50;
  const circ = 2 * Math.PI * r;

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {slices.length === 0 ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="14" />
      ) : (
        slices.map((s, i) => {
          const len = (s.pct / 100) * circ;
          const gap = 0;
          const offset = circ - cumulative * circ / 100;
          cumulative += s.pct;
          return (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              className={s.color.replace('bg-', 'stroke-')}
              strokeWidth="14"
              strokeDasharray={`${len - gap} ${circ - len + gap}`}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dasharray 0.4s ease' }}
            />
          );
        })
      )}
      <circle cx={cx} cy={cy} r={26} fill="white" className="dark:fill-slate-900" />
    </svg>
  );
}

function ExpenseFormModal({
  initial, onSave, onClose,
}: {
  initial?: Partial<ExpenseForm>;
  onSave: (f: ExpenseForm) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState<ExpenseForm>({
    date: initial?.date ?? today,
    category: initial?.category ?? EXPENSE_CATEGORIES[0],
    description: initial?.description ?? '',
    amount: initial?.amount ?? 0,
    vendor: initial?.vendor ?? '',
  });

  const CATEGORY_KEYS: Record<string, string> = {
    'Nómina': t('cat_payroll'),
    'Marketing': t('cat_marketing'),
    'Alquiler': t('cat_rent'),
    'Servicios': t('cat_services'),
    'Tecnología': t('cat_technology'),
    'Transporte': t('cat_transport'),
    'Suministros': t('cat_supplies'),
    'Impuestos': t('cat_taxes'),
    'Seguros': t('cat_insurance'),
    'Otros': t('cat_other'),
  };

  const set = (k: keyof ExpenseForm, v: string | number) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.description.trim() && form.amount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{initial ? 'Editar Gasto' : 'Registrar Gasto'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('date')}</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Monto (DOP)</label>
              <input type="number" min="0" step="0.01" value={form.amount || ''}
                onChange={e => set('amount', parseFloat(e.target.value) || 0)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('expense_category')}</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500">
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_KEYS[c] ?? c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Descripción</label>
            <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              placeholder="Ej. Pago de servidor, nómina quincenal..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('expense_vendor')} (opcional)</label>
            <input type="text" value={form.vendor ?? ''} onChange={e => set('vendor', e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              placeholder="Nombre del proveedor" />
          </div>
        </div>
        <div className="flex gap-2 px-6 pb-5">
          <button onClick={onClose}
            className="flex-1 border border-slate-200 text-slate-600 rounded-lg py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
            Cancelar
          </button>
          <button onClick={() => valid && onSave(form)} disabled={!valid}
            className="flex-1 bg-sky-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-sky-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <Check size={15} />
            {initial ? 'Guardar' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Admin all-companies summary hook ──────────────────────────────────────────

interface CompanySummary {
  id: string;
  name: string;
  revenue: number;
  pending: number;
  invoiceCount: number;
  paidCount: number;
}

function useAllCompaniesSummary(enabled: boolean) {
  const [summaries, setSummaries] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    Promise.all([
      db.from('companies').select('id, name').eq('is_active', true).order('name'),
      db.from('invoices').select('company_id, status, total, amount_paid'),
    ]).then(([companiesRes, invoicesRes]) => {
      const companies = (companiesRes.data ?? []) as Array<{ id: string; name: string }>;
      const invoices = (invoicesRes.data ?? []) as Array<{
        company_id: string;
        status: string;
        total: number;
        amount_paid: number;
      }>;
      const result: CompanySummary[] = companies.map(co => {
        const coInvoices = invoices.filter(i => i.company_id === co.id);
        const revenue = coInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
        const pending = coInvoices.filter(i => ['sent', 'partial', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.total - i.amount_paid), 0);
        return {
          id: co.id,
          name: co.name,
          revenue,
          pending,
          invoiceCount: coInvoices.length,
          paidCount: coInvoices.filter(i => i.status === 'paid').length,
        };
      });
      setSummaries(result);
      setLoading(false);
    });
  }, [enabled]);

  return { summaries, loading };
}

// ── Main Component ────────────────────────────────────────────────────────────

interface AnalyticsProps {
  companyId?: string;
  isAdmin?: boolean;
}

export default function Analytics({ companyId, isAdmin }: AnalyticsProps) {
  const { t, formatCurrency, formatDate } = useI18n();
  const { invoices } = useInvoices(companyId);
  const { expenses, loading: expLoading, add, update, remove } = useExpenses(companyId);
  const { summaries: companySummaries, loading: summariesLoading } = useAllCompaniesSummary(!!isAdmin && !companyId);

  const CATEGORY_KEYS: Record<string, string> = {
    'Nómina': t('cat_payroll'),
    'Marketing': t('cat_marketing'),
    'Alquiler': t('cat_rent'),
    'Servicios': t('cat_services'),
    'Tecnología': t('cat_technology'),
    'Transporte': t('cat_transport'),
    'Suministros': t('cat_supplies'),
    'Impuestos': t('cat_taxes'),
    'Seguros': t('cat_insurance'),
    'Otros': t('cat_other'),
  };

  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [filterMonth, setFilterMonth] = useState('Todos');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const months = last6Months();
  const currentMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];

  // ── Revenue aggregations ──
  const revenueByMonth: Record<string, number> = {};
  invoices.filter(i => i.status === 'paid').forEach(i => {
    const m = monthKey(i.issue_date ?? '');
    revenueByMonth[m] = (revenueByMonth[m] ?? 0) + i.total;
  });

  // ── Expense aggregations ──
  const expByMonth: Record<string, number> = {};
  const expByCategory: Record<string, number> = {};
  expenses.forEach(e => {
    const m = monthKey(e.date);
    expByMonth[m] = (expByMonth[m] ?? 0) + e.amount;
    expByCategory[e.category] = (expByCategory[e.category] ?? 0) + e.amount;
  });

  // ── KPI values ──
  const totalRevenueCurrent = revenueByMonth[currentMonth] ?? 0;
  const totalRevenuePrev    = revenueByMonth[prevMonth] ?? 0;
  const totalExpCurrent     = expByMonth[currentMonth] ?? 0;
  const totalExpPrev        = expByMonth[prevMonth] ?? 0;
  const netProfitCurrent    = totalRevenueCurrent - totalExpCurrent;
  const netProfitPrev       = totalRevenuePrev - totalExpPrev;
  const marginCurrent       = totalRevenueCurrent > 0 ? (netProfitCurrent / totalRevenueCurrent) * 100 : 0;
  const marginPrev          = totalRevenuePrev > 0 ? (netProfitPrev / totalRevenuePrev) * 100 : 0;

  const totalRevenue6m = months.reduce((s, m) => s + (revenueByMonth[m] ?? 0), 0);
  const totalExp6m     = months.reduce((s, m) => s + (expByMonth[m] ?? 0), 0);
  const netProfit6m    = totalRevenue6m - totalExp6m;

  // ── Chart data ──
  const chartData = months.map(m => ({
    label: monthLabel(m),
    revenue: revenueByMonth[m] ?? 0,
    expenses: expByMonth[m] ?? 0,
  }));
  const chartMax = Math.max(...chartData.map(d => Math.max(d.revenue, d.expenses)), 1);

  // ── Donut slices ──
  const totalExpAll = Object.values(expByCategory).reduce((s, v) => s + v, 0);
  const donutSlices = Object.entries(expByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([label, amt]) => ({
      label,
      pct: totalExpAll > 0 ? (amt / totalExpAll) * 100 : 0,
      color: CATEGORY_COLORS[label] ?? 'bg-slate-400',
      amount: amt,
    }));

  // ── Filtered expense list ──
  const filteredExpenses = expenses.filter(e => {
    const catOk = filterCategory === 'Todas' || e.category === filterCategory;
    const monOk = filterMonth === 'Todos' || monthKey(e.date) === filterMonth;
    return catOk && monOk;
  });

  // ── Efficiency score (0-100) ──
  const efficiency = totalRevenueCurrent > 0
    ? Math.min(100, Math.round((netProfitCurrent / totalRevenueCurrent) * 100 + 50))
    : 50;

  const handleSave = async (form: ExpenseForm) => {
    if (editingExpense) {
      await update(editingExpense.id, form);
    } else {
      await add(form);
    }
    setShowForm(false);
    setEditingExpense(null);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('analytics_title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Monitorea el crecimiento y eficiencia de tu empresa</p>
        </div>
        <button
          onClick={() => { setEditingExpense(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 bg-sky-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-sky-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          {t('add_expense')}
        </button>
      </div>

      {/* Admin: all-companies breakdown */}
      {isAdmin && !companyId && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <Building2 size={16} className="text-slate-500 dark:text-slate-400" />
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Resumen por Empresa</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">Vista consolidada de todas las empresas activas</p>
            </div>
          </div>
          {summariesLoading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />)}
            </div>
          ) : companySummaries.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">No hay empresas registradas</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Empresa</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Facturas</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Pagadas</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ingresos</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {companySummaries.map(co => {
                    const totalRevAll = companySummaries.reduce((s, c) => s + c.revenue, 0);
                    const revPct = totalRevAll > 0 ? (co.revenue / totalRevAll) * 100 : 0;
                    return (
                      <tr key={co.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
                              <Building2 size={12} className="text-sky-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{co.name}</p>
                              <div className="mt-1 w-24 bg-slate-100 dark:bg-slate-800 rounded-full h-1">
                                <div className="h-1 bg-sky-400 rounded-full" style={{ width: `${revPct}%` }} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-slate-600 dark:text-slate-400">{co.invoiceCount}</td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-sm text-emerald-600 font-medium">{co.paidCount}</span>
                          {co.invoiceCount > 0 && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">({Math.round(co.paidCount / co.invoiceCount * 100)}%)</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(co.revenue)}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`text-sm font-medium ${co.pending > 0 ? 'text-amber-600' : 'text-slate-400 dark:text-slate-500'}`}>
                            {formatCurrency(co.pending)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <td className="px-5 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Total consolidado</td>
                    <td className="px-5 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400">{companySummaries.reduce((s, c) => s + c.invoiceCount, 0)}</td>
                    <td className="px-5 py-3 text-right text-xs font-semibold text-emerald-600">{companySummaries.reduce((s, c) => s + c.paidCount, 0)}</td>
                    <td className="px-5 py-3 text-right text-xs font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(companySummaries.reduce((s, c) => s + c.revenue, 0))}</td>
                    <td className="px-5 py-3 text-right text-xs font-semibold text-amber-600">{formatCurrency(companySummaries.reduce((s, c) => s + c.pending, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={t('income_label')}
          value={formatCurrency(totalRevenueCurrent)}
          sub={`Mes anterior: ${formatCurrency(totalRevenuePrev)}`}
          icon={TrendingUp}
          color="bg-sky-500"
          trend={pct(totalRevenueCurrent, totalRevenuePrev)}
          trendLabel="vs mes anterior"
        />
        <KpiCard
          label={t('expenses_title')}
          value={formatCurrency(totalExpCurrent)}
          sub={`Mes anterior: ${formatCurrency(totalExpPrev)}`}
          icon={ShoppingCart}
          color="bg-rose-500"
          trend={pct(totalExpCurrent, totalExpPrev)}
          trendLabel="vs mes anterior"
        />
        <KpiCard
          label={t('net_profit')}
          value={formatCurrency(netProfitCurrent)}
          sub={`Margen: ${marginCurrent.toFixed(1)}%`}
          icon={DollarSign}
          color={netProfitCurrent >= 0 ? 'bg-emerald-500' : 'bg-amber-500'}
          trend={pct(marginCurrent, marginPrev)}
          trendLabel="vs mes anterior"
        />
        <KpiCard
          label="Utilidad Neta (6 meses)"
          value={formatCurrency(netProfit6m)}
          sub={`Ingresos: ${formatCurrency(totalRevenue6m)}`}
          icon={Target}
          color="bg-teal-500"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Bar chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('revenue_vs_expenses')}</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">Últimos 6 meses</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sky-400 inline-block" /> {t('income_label')}</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block" /> {t('expenses_title')}</span>
            </div>
          </div>
          <BarChart data={chartData} maxVal={chartMax} formatCurrency={formatCurrency} incomeLbl={t('income_label')} expensesLbl={t('expenses_title')} />
        </div>

        {/* Donut + legend */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('expense_by_category')}</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">Total acumulado</p>
          </div>
          <div className="w-28 h-28 mx-auto mb-4">
            <DonutChart slices={donutSlices} />
          </div>
          <div className="space-y-2">
            {donutSlices.map(s => (
              <div key={s.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${s.color} inline-block shrink-0`} />
                  <span className="text-slate-600 dark:text-slate-400">{CATEGORY_KEYS[s.label] ?? s.label}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-800 dark:text-slate-100 font-medium">{s.pct.toFixed(0)}%</span>
                </div>
              </div>
            ))}
            {donutSlices.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-2">{t('no_expenses')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Efficiency + Growth summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Activity size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Eficiencia</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{efficiency}<span className="text-sm font-normal text-slate-400 dark:text-slate-500">/100</span></p>
            </div>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${efficiency >= 70 ? 'bg-emerald-500' : efficiency >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${efficiency}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            {efficiency >= 70 ? 'Empresa operando eficientemente' : efficiency >= 40 ? 'Margen de mejora disponible' : 'Atención requerida'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-sky-50 rounded-lg flex items-center justify-center">
              <BarChart2 size={16} className="text-sky-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Margen Bruto</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{marginCurrent.toFixed(1)}<span className="text-sm font-normal text-slate-400 dark:text-slate-500">%</span></p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs">
            {marginCurrent >= marginPrev
              ? <ArrowUpRight size={13} className="text-emerald-500" />
              : <ArrowDownRight size={13} className="text-red-500" />}
            <span className={marginCurrent >= marginPrev ? 'text-emerald-600' : 'text-red-500'}>
              {Math.abs(pct(marginCurrent, marginPrev)).toFixed(1)}% vs mes anterior
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
              <Briefcase size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Burn Rate</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatCurrency(totalExpCurrent)}</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Gasto mensual promedio (6m): {formatCurrency(totalExp6m / 6)}
          </p>
        </div>
      </div>

      {/* Expense register */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Registro de Gastos</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">{filteredExpenses.length} registros</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Category filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Filter size={13} />
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500">
                <option value="Todas">Todas las categorías</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Calendar size={13} />
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500">
                <option value="Todos">Todos los meses</option>
                {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </div>
          </div>
        </div>

        {expLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
            <PieChart size={32} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">{t('no_expenses')}</p>
            <p className="text-xs mt-1">Haz clic en "Registrar Gasto" para comenzar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('date')}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Descripción</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">{t('expense_category')}</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">{t('expense_vendor')}</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Monto</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(exp => (
                  <tr key={exp.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDate(exp.date)}</td>
                    <td className="px-5 py-3 text-slate-800 dark:text-slate-100 font-medium max-w-xs truncate">{exp.description}</td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[exp.category] ?? 'bg-slate-400'} inline-block`} />
                        <span className="text-slate-600 dark:text-slate-400">{CATEGORY_KEYS[exp.category] ?? exp.category}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400 text-xs hidden md:table-cell">{exp.vendor ?? '-'}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">{formatCurrency(exp.amount)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingExpense(exp); setShowForm(true); }}
                          className="p-1.5 rounded-lg hover:bg-sky-50 text-slate-400 dark:text-slate-600 hover:text-sky-600 transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                        {deleteConfirm === exp.id ? (
                          <button
                            onClick={() => { remove(exp.id); setDeleteConfirm(null); }}
                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          >
                            <Check size={13} />
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(exp.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 dark:text-slate-600 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <td colSpan={4} className="px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Total filtrado</td>
                  <td className="px-5 py-3 text-right font-bold text-slate-800 dark:text-slate-100">
                    {formatCurrency(filteredExpenses.reduce((s, e) => s + e.amount, 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <ExpenseFormModal
          initial={editingExpense ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingExpense(null); }}
        />
      )}
    </div>
  );
}
