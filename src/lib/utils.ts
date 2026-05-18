// Legacy formatters — used by components that haven't migrated to useI18n() yet.
// New code should use useI18n().formatCurrency / formatDate instead.
export function formatCurrency(amount: number, currency = 'DOP', locale = 'es-DO') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string | null | undefined, locale = 'es-DO') {
  if (!dateStr) return '-';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function formatDateTime(dateStr: string | null | undefined, locale = 'es-DO') {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusColor(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    sent: 'bg-blue-100 text-blue-700',
    paid: 'bg-emerald-100 text-emerald-700',
    partial: 'bg-amber-100 text-amber-700',
    overdue: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
    void: 'bg-gray-100 text-gray-400',
  };
  return map[status] ?? 'bg-gray-100 text-gray-500';
}

// Returns a translated status label. Pass the t() function from useI18n().
export function getStatusLabel(status: string, t?: (k: string) => string): string {
  const map: Record<string, string> = {
    draft: t ? t('status_draft') : 'Borrador',
    sent: t ? t('status_sent') : 'Enviada',
    paid: t ? t('status_paid') : 'Pagada',
    partial: t ? t('status_partial') : 'Pago Parcial',
    overdue: t ? t('status_overdue') : 'Vencida',
    cancelled: t ? t('status_cancelled') : 'Cancelada',
    void: t ? t('status_void') : 'Anulada',
  };
  return map[status] ?? status;
}

export function getElectronicStatusColor(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-600',
    submitted: 'bg-blue-100 text-blue-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-500';
}

export function getElectronicStatusLabel(status: string, t?: (k: string) => string): string {
  const map: Record<string, string> = {
    pending: t ? t('estatus_pending') : 'Pendiente',
    submitted: t ? t('estatus_submitted') : 'Enviada',
    approved: t ? t('estatus_approved') : 'Aprobada',
    rejected: t ? t('estatus_rejected') : 'Rechazada',
  };
  return map[status] ?? status;
}

export function generateInvoiceNumber(prefix: string, next: number) {
  return `${prefix}-${String(next).padStart(6, '0')}`;
}

export function getDaysUntilDue(dueDate: string | null) {
  if (!dueDate) return null;
  const due = new Date(dueDate + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
