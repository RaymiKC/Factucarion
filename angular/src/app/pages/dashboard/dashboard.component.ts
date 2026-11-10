import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { I18nService } from '../../services/i18n.service';
import { DataService } from '../../services/data.service';
import { CompanyService } from '../../services/company.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="space-y-6">
  <!-- Metric cards -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    <div *ngFor="let card of metricCards" class="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow">
      <div class="flex items-start justify-between">
        <div>
          <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">{{card.label}}</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{card.value}}</p>
        </div>
        <div [class]="'p-3 rounded-xl ' + card.iconBg">
          <span [innerHTML]="card.icon" [class]="card.iconColor"></span>
        </div>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Monthly bar chart -->
    <div class="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{i18n.t('monthly_revenue')}}</h3>
      <div class="flex items-end gap-2 h-48">
        <div *ngFor="let m of monthlyData" class="flex-1 flex flex-col items-center gap-1">
          <div class="w-full bg-blue-100 dark:bg-blue-900/20 rounded-t-md relative" [style.height]="getBarHeight(m.total) + 'px'" title="{{data.formatCurrency(m.total)}}">
            <div class="absolute inset-0 bg-blue-500 dark:bg-blue-600 rounded-t-md opacity-80"></div>
          </div>
          <span class="text-xs text-gray-500 dark:text-gray-400">{{m.month}}</span>
        </div>
      </div>
    </div>

    <!-- Recent invoices -->
    <div class="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{i18n.t('recent_invoices')}}</h3>
        <button (click)="router.navigate(['/invoices'])" class="text-sm text-blue-600 dark:text-blue-400 hover:underline">{{i18n.t('view_all')}}</button>
      </div>
      <div class="space-y-3">
        <div *ngFor="let inv of recentInvoices" class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{inv.invoice_number}}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{inv.client?.name ?? '—'}}</p>
          </div>
          <div class="text-right ml-2 shrink-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{data.formatCurrency(inv.total, inv.currency)}}</p>
            <span [class]="'inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium ' + data.getStatusColor(inv.status)">{{i18n.t(inv.status)}}</span>
          </div>
        </div>
        <p *ngIf="!recentInvoices.length" class="text-sm text-gray-400 text-center py-4">{{i18n.t('no_data')}}</p>
      </div>
    </div>
  </div>

  <!-- Overdue alert -->
  <div *ngIf="overdueInvoices.length > 0" class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-4">
    <div class="flex items-center gap-2 mb-3">
      <svg class="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
      <h3 class="text-sm font-semibold text-red-700 dark:text-red-400">{{i18n.t('overdue_invoices')}} ({{overdueInvoices.length}})</h3>
    </div>
    <div class="space-y-2">
      <div *ngFor="let inv of overdueInvoices.slice(0,5)" class="flex items-center justify-between text-sm">
        <span class="text-red-700 dark:text-red-400">{{inv.invoice_number}} — {{inv.client?.name ?? '—'}}</span>
        <span class="font-semibold text-red-600 dark:text-red-400">{{data.formatCurrency(inv.total - inv.amount_paid, inv.currency)}}</span>
      </div>
    </div>
  </div>
</div>
  `
})
export class DashboardComponent implements OnInit {
  private sanitizer = inject(DomSanitizer);

  constructor(public i18n: I18nService, public data: DataService, private company: CompanyService, public router: Router) {}

  ngOnInit() { this.data.loadAll(this.company.currentCompany()?.id); }

  get recentInvoices() { return this.data.invoices().slice(0, 8); }
  get overdueInvoices() { return this.data.invoices().filter(i => i.status === 'overdue'); }

  get metricCards() {
    const invs = this.data.invoices();
    const totalRevenue = invs.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
    const pending = invs.filter(i => ['sent','partial'].includes(i.status)).reduce((s, i) => s + (i.total - i.amount_paid), 0);
    const now = new Date();
    const collectedThisMonth = invs.filter(i => i.status === 'paid' && i.payment_date && new Date(i.payment_date).getMonth() === now.getMonth() && new Date(i.payment_date).getFullYear() === now.getFullYear()).reduce((s, i) => s + i.amount_paid, 0);
    return [
      { label: this.i18n.t('total_revenue'), value: this.data.formatCurrency(totalRevenue), iconBg: 'bg-green-100 dark:bg-green-900/20', iconColor: 'text-green-600 dark:text-green-400', icon: '<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' },
      { label: this.i18n.t('pending_collection'), value: this.data.formatCurrency(pending), iconBg: 'bg-yellow-100 dark:bg-yellow-900/20', iconColor: 'text-yellow-600 dark:text-yellow-400', icon: '<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' },
      { label: this.i18n.t('overdue_invoices'), value: String(this.overdueInvoices.length), iconBg: 'bg-red-100 dark:bg-red-900/20', iconColor: 'text-red-600 dark:text-red-400', icon: '<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>' },
      { label: this.i18n.t('collected_this_month'), value: this.data.formatCurrency(collectedThisMonth), iconBg: 'bg-blue-100 dark:bg-blue-900/20', iconColor: 'text-blue-600 dark:text-blue-400', icon: '<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
      { label: this.i18n.t('total_invoices'), value: String(invs.length), iconBg: 'bg-gray-100 dark:bg-gray-800', iconColor: 'text-gray-600 dark:text-gray-400', icon: '<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' },
      { label: this.i18n.t('active_clients'), value: String(this.data.clients().filter(c => c.is_active).length), iconBg: 'bg-teal-100 dark:bg-teal-900/20', iconColor: 'text-teal-600 dark:text-teal-400', icon: '<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>' },
    ].map(card => ({ ...card, icon: this.sanitizer.bypassSecurityTrustHtml(card.icon) }));
  }

  get monthlyData() {
    const months: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months[d.toLocaleString('default', { month: 'short' })] = 0;
    }
    for (const inv of this.data.invoices().filter(i => i.status === 'paid' && i.payment_date)) {
      const d = new Date(inv.payment_date!);
      const key = d.toLocaleString('default', { month: 'short' });
      if (key in months) months[key] = (months[key] ?? 0) + inv.total;
    }
    return Object.entries(months).map(([month, total]) => ({ month, total }));
  }

  getBarHeight(total: number): number {
    const max = Math.max(...this.monthlyData.map(m => m.total), 1);
    return Math.max(4, (total / max) * 160);
  }
}
