import { TrendingUp, FileText, Users, AlertTriangle, DollarSign, Clock, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { useDashboardMetrics } from '../lib/hooks';
import { getStatusColor, getStatusLabel } from '../lib/utils';
import { useI18n } from '../lib/i18n';

interface DashboardProps {
  onNavigate: (page: string) => void;
  companyId?: string;
}

export default function Dashboard({ onNavigate, companyId }: DashboardProps) {
  const { metrics, loading } = useDashboardMetrics(companyId);
  const { t, formatCurrency, formatDate } = useI18n();

  const cards = [
    {
      label: t('total_revenue'),
      value: formatCurrency(metrics.totalRevenue),
      icon: DollarSign,
      color: 'bg-emerald-50 text-emerald-600',
      border: 'border-emerald-200',
      change: `${metrics.invoicesThisMonth} ${t('invoices_title').toLowerCase()} ${t('vs_last_month')}`,
    },
    {
      label: t('pending_collection'),
      value: formatCurrency(metrics.pendingAmount),
      icon: Clock,
      color: 'bg-amber-50 text-amber-600',
      border: 'border-amber-200',
      change: t('status_sent'),
    },
    {
      label: t('overdue_invoices'),
      value: formatCurrency(metrics.overdueAmount),
      icon: AlertTriangle,
      color: 'bg-red-50 text-red-600',
      border: 'border-red-200',
      change: `${metrics.overdueCount} ${t('invoices_title').toLowerCase()}`,
    },
    {
      label: t('collected_this_month'),
      value: formatCurrency(metrics.paidThisMonth),
      icon: CheckCircle2,
      color: 'bg-sky-50 text-sky-600',
      border: 'border-sky-200',
      change: t('payments_title'),
    },
    {
      label: t('total_invoices'),
      value: metrics.totalInvoices.toString(),
      icon: FileText,
      color: 'bg-slate-50 text-slate-600',
      border: 'border-slate-200',
      change: t('invoices_total'),
    },
    {
      label: t('active_clients'),
      value: metrics.totalClients.toString(),
      icon: Users,
      color: 'bg-teal-50 text-teal-600',
      border: 'border-teal-200',
      change: t('active_clients_count'),
    },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-3" />
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(...metrics.monthlyRevenue.map(m => m.amount), 1);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('dashboard_title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('dashboard_subtitle')}</p>
        </div>
        <button
          onClick={() => onNavigate('invoices')}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg whitespace-nowrap shrink-0 transition-colors"
        >
          <FileText size={15} />
          {t('new_invoice')}
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, color, border, change }) => (
          <div key={label} className={`bg-white dark:bg-slate-900 rounded-xl border ${border} dark:border-slate-800 p-5 hover:shadow-sm transition-shadow`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{change}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Chart */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('monthly_revenue')}</h3>
            <TrendingUp size={16} className="text-slate-400 dark:text-slate-500" />
          </div>
          {metrics.monthlyRevenue.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              {t('no_revenue_data')}
            </div>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {metrics.monthlyRevenue.map(({ month, amount }) => {
                const height = (amount / maxRevenue) * 100;
                const [year, m] = month.split('-');
                const label = new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString(undefined, { month: 'short' });
                return (
                  <div key={month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{formatCurrency(amount)}</span>
                    <div className="w-full flex items-end" style={{ height: '100px' }}>
                      <div
                        className="w-full bg-sky-500 rounded-t-md hover:bg-sky-600 transition-colors cursor-default"
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={`${label}: ${formatCurrency(amount)}`}
                      />
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 capitalize">{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('recent_invoices')}</h3>
            <button onClick={() => onNavigate('invoices')} className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1 font-medium">
              {t('all')} <ArrowUpRight size={12} />
            </button>
          </div>
          {metrics.recentInvoices.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              {t('no_invoices_yet')}
            </div>
          ) : (
            <div className="space-y-2">
              {metrics.recentInvoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
                      <FileText size={14} className="text-slate-500 dark:text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{inv.invoice_number}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{(inv.client as { name?: string } | undefined)?.name ?? '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(inv.status)}`}>
                      {getStatusLabel(inv.status)}
                    </span>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(inv.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Overdue Alert */}
      {metrics.overdueCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">
                {metrics.overdueCount} {t('overdue_invoices').toLowerCase()}
              </p>
              <p className="text-xs text-red-500">
                {t('pending_collection')}: {formatCurrency(metrics.overdueAmount)}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('invoices')}
            className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            Ver <ArrowUpRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
