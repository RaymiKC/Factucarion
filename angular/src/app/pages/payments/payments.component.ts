import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../services/i18n.service';
import { DataService } from '../../services/data.service';
import { CompanyService } from '../../services/company.service';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="space-y-6">
  <!-- Summary cards -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div *ngFor="let m of methodTotals" class="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800">
      <p class="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">{{i18n.t(m.method)}}</p>
      <p class="text-xl font-bold text-gray-900 dark:text-white mt-1">{{data.formatCurrency(m.total)}}</p>
      <p class="text-xs text-gray-400 mt-0.5">{{m.count}} pago(s)</p>
    </div>
  </div>

  <!-- Filter -->
  <div class="flex gap-3">
    <input [(ngModel)]="search" type="text" [placeholder]="i18n.t('search')"
      class="w-full sm:w-64 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
    <select [(ngModel)]="methodFilter" class="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
      <option value="">{{i18n.t('filter')}} {{i18n.t('payment_method')}}</option>
      <option *ngFor="let m of methods" [value]="m">{{i18n.t(m)}}</option>
    </select>
  </div>

  <!-- Table -->
  <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-800/50">
          <tr>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('date')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('invoice_number')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('payment_method')}}</th>
            <th class="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('amount')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">{{i18n.t('reference')}}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr *ngFor="let p of filtered" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{{data.formatDate(p.payment_date)}}</td>
            <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{{getInvoiceNumber(p.invoice_id)}}</td>
            <td class="px-6 py-4">
              <span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">{{i18n.t(p.payment_method)}}</span>
            </td>
            <td class="px-6 py-4 text-right text-sm font-bold text-green-600 dark:text-green-400">{{data.formatCurrency(p.amount)}}</td>
            <td class="px-6 py-4 text-sm text-gray-500 hidden md:table-cell">{{p.reference || '—'}}</td>
          </tr>
          <tr *ngIf="!filtered.length"><td colspan="5" class="text-center py-12 text-gray-400">{{i18n.t('no_data')}}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
  `
})
export class PaymentsComponent implements OnInit {
  search = '';
  methodFilter = '';
  methods = ['cash','transfer','check','card','other'];

  constructor(public i18n: I18nService, public data: DataService, private company: CompanyService) {}
  ngOnInit() { this.data.loadPaymentRecords(this.company.currentCompany()?.id); this.data.loadInvoices(this.company.currentCompany()?.id); }

  get filtered() {
    return this.data.paymentRecords().filter(p => {
      const q = this.search.toLowerCase();
      return (!q || p.reference?.toLowerCase().includes(q) || this.getInvoiceNumber(p.invoice_id).toLowerCase().includes(q))
        && (!this.methodFilter || p.payment_method === this.methodFilter);
    });
  }

  get methodTotals() {
    const map: Record<string, { total: number; count: number }> = {};
    for (const m of this.methods) map[m] = { total: 0, count: 0 };
    for (const p of this.data.paymentRecords()) {
      if (!map[p.payment_method]) map[p.payment_method] = { total: 0, count: 0 };
      map[p.payment_method].total += p.amount;
      map[p.payment_method].count++;
    }
    return this.methods.map(m => ({ method: m, ...map[m] })).filter(m => m.count > 0);
  }

  getInvoiceNumber(id: string): string {
    return this.data.invoices().find(i => i.id === id)?.invoice_number ?? id.slice(0,8);
  }
}
