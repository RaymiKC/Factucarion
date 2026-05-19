import { Bell, CheckCheck, FileText, DollarSign, AlertTriangle, Zap, Info, Clock } from 'lucide-react';
import { useNotifications } from '../lib/hooks';
import type { Notification } from '../lib/supabase';
import { formatDateTime } from '../lib/utils';
import { useI18n } from '../lib/i18n';

const typeConfig: Record<Notification['type'], { icon: typeof Bell; color: string; bg: string }> = {
  invoice_sent: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
  payment_received: { icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  overdue: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  reminder: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  system: { icon: Info, color: 'text-slate-600', bg: 'bg-slate-100' },
  electronic: { icon: Zap, color: 'text-sky-600', bg: 'bg-sky-50' },
};

export default function Notifications() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const { t } = useI18n();

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('notifications_title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} ${t('status_sent').toLowerCase()}` : t('no_notifications')}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700">
            <CheckCheck size={16} /> {t('mark_all_read')}
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('no_notifications')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.map(n => {
              const cfg = typeConfig[n.type] ?? typeConfig.system;
              const Icon = cfg.icon;
              return (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  className={`flex items-start gap-4 p-4 transition-colors cursor-pointer ${n.is_read ? 'bg-white dark:bg-slate-900' : 'bg-sky-50/40 dark:bg-sky-900/10 hover:bg-sky-50 dark:hover:bg-sky-900/20'}`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    <Icon size={16} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium ${n.is_read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>{n.title}</p>
                      {!n.is_read && <span className="w-2 h-2 bg-sky-500 rounded-full shrink-0 mt-1.5" />}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{formatDateTime(n.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
