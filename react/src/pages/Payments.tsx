import { useState, useEffect } from 'react';
import { CreditCard, DollarSign, TrendingUp, Search } from 'lucide-react';
import { db } from '../lib/db';
import type { PaymentRecord, Invoice, Client } from '../lib/types';
import { useI18n } from '../lib/i18n';

interface PaymentsProps {
  companyId?: string;
}

export default function Payments({ companyId }: PaymentsProps) {
  const { t, formatCurrency, formatDate } = useI18n();
  const [payments, setPayments] = useState<(PaymentRecord & { invoice?: Invoice & { client?: Client } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const methodLabels: Record<string, string> = {
    cash: t('method_cash'),
    transfer: t('method_transfer'),
    check: t('method_check'),
    card: t('method_card'),
    other: t('method_other'),
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = db
        .from('payment_records')
        .select('*, invoice:invoices(*, client:clients(name))')
        .order('payment_date', { ascending: false });
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
      const { data } = await query;
      setPayments(data ?? []);
      setLoading(false);
    }
    load();
  }, [companyId]);

  const filtered = payments.filter(p => {
    if (!search) return true;
    const inv = p.invoice;
    return (
      inv?.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      (inv?.client as Client | undefined)?.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.reference?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const totalAmount = filtered.reduce((s, p) => s + p.amount, 0);
  const byMethod = filtered.reduce((acc, p) => {
    acc[p.payment_method] = (acc[p.payment_method] ?? 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('payments_title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{payments.length} pagos registrados</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <DollarSign size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('total_collected')}</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{formatCurrency(totalAmount)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
            <CreditCard size={18} className="text-sky-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('payment_count')}</p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{filtered.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('by_method')}</p>
          <div className="space-y-1">
            {Object.entries(byMethod).map(([method, amount]) => (
              <div key={method} className="flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-400">{methodLabels[method] ?? method}</span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar por factura, cliente o referencia..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">{t('loading_payments')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('no_payments')}</p>
          </div>
        ) : (
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Factura</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden md:table-cell">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden lg:table-cell">Método</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden lg:table-cell">Referencia</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Monto</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400">{formatDate(p.payment_date)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.invoice?.invoice_number ?? '-'}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm text-slate-600 dark:text-slate-400">{(p.invoice?.client as Client | undefined)?.name ?? '-'}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-medium">
                        {methodLabels[p.payment_method] ?? p.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="text-xs text-slate-500 dark:text-slate-500 font-mono">{p.reference || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-sm font-bold text-emerald-600">{formatCurrency(p.amount)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map(p => (
              <div key={p.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{p.invoice?.invoice_number ?? '-'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {(p.invoice?.client as Client | undefined)?.name ?? '-'}
                    </p>
                  </div>
                  <p className="text-base font-bold text-emerald-600 shrink-0">{formatCurrency(p.amount)}</p>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{formatDate(p.payment_date)}</span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-medium">
                    {methodLabels[p.payment_method] ?? p.payment_method}
                  </span>
                </div>
                {p.reference && <p className="text-xs text-slate-400 dark:text-slate-500 font-mono truncate">{p.reference}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
