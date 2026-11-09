import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../services/i18n.service';
import { DataService } from '../../services/data.service';
import { CompanyService } from '../../services/company.service';
import { AuthService } from '../../services/auth.service';
import { Invoice } from '../../services/models';

@Component({
  selector: 'app-monthly-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="space-y-6">
  <!-- Filters -->
  <div class="flex flex-wrap gap-3 items-center bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800">
    <div>
      <label class="block text-xs font-medium text-gray-500 mb-1">{{i18n.t('month')}}</label>
      <select [(ngModel)]="selectedMonth" (change)="filter()" class="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
        <option *ngFor="let m of months; let i = index" [value]="i+1">{{m}}</option>
      </select>
    </div>
    <div>
      <label class="block text-xs font-medium text-gray-500 mb-1">{{i18n.t('year')}}</label>
      <select [(ngModel)]="selectedYear" (change)="filter()" class="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
        <option *ngFor="let y of years" [value]="y">{{y}}</option>
      </select>
    </div>
    <div class="ml-auto mt-4">
      <button (click)="exportCSV()" class="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        {{i18n.t('export_csv')}}
      </button>
    </div>
  </div>

  <!-- Summary cards -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800">
      <p class="text-xs text-gray-500 font-medium">{{i18n.t('subtotal')}}</p>
      <p class="text-xl font-bold text-gray-900 dark:text-white mt-1">{{data.formatCurrency(summary.subtotal)}}</p>
    </div>
    <div class="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800">
      <p class="text-xs text-gray-500 font-medium">{{i18n.t('tax')}}</p>
      <p class="text-xl font-bold text-gray-900 dark:text-white mt-1">{{data.formatCurrency(summary.tax)}}</p>
    </div>
    <div class="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800">
      <p class="text-xs text-gray-500 font-medium">{{i18n.t('total')}}</p>
      <p class="text-xl font-bold text-gray-900 dark:text-white mt-1">{{data.formatCurrency(summary.total)}}</p>
    </div>
    <div class="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-200 dark:border-gray-800">
      <p class="text-xs text-gray-500 font-medium">{{i18n.t('paid')}}</p>
      <p class="text-xl font-bold text-green-600 dark:text-green-400 mt-1">{{data.formatCurrency(summary.paid)}}</p>
    </div>
  </div>

  <!-- Table -->
  <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-800/50">
          <tr>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('invoice_number')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('client')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">{{i18n.t('ncf')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('status')}}</th>
            <th class="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('total')}}</th>
            <th class="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">{{i18n.t('paid')}}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr *ngFor="let inv of filteredInvoices" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <td class="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">{{inv.invoice_number}}</td>
            <td class="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">{{inv.client?.name ?? '—'}}</td>
            <td class="px-6 py-3 text-sm font-mono text-gray-500 hidden md:table-cell">{{inv.ncf || '—'}}</td>
            <td class="px-6 py-3">
              <span [class]="'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ' + data.getStatusColor(inv.status)">{{i18n.t(inv.status)}}</span>
            </td>
            <td class="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">{{data.formatCurrency(inv.total, inv.currency)}}</td>
            <td class="px-6 py-3 text-right text-sm text-green-600 dark:text-green-400 hidden lg:table-cell">{{data.formatCurrency(inv.amount_paid, inv.currency)}}</td>
          </tr>
          <tr *ngIf="!filteredInvoices.length"><td colspan="6" class="text-center py-12 text-gray-400">{{i18n.t('no_data')}}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
  `
})
export class MonthlyReportComponent implements OnInit {
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  filteredInvoices: Invoice[] = [];

  constructor(public i18n: I18nService, public data: DataService, private company: CompanyService, private auth: AuthService) {}

  ngOnInit() {
    this.data.loadInvoices(this.company.currentCompany()?.id).then(() => this.filter());
  }

  filter() {
    this.filteredInvoices = this.data.invoices().filter(inv => {
      const d = new Date(inv.issue_date);
      return d.getMonth() + 1 === this.selectedMonth && d.getFullYear() === this.selectedYear;
    });
  }

  get summary() {
    return this.filteredInvoices.reduce((s, inv) => ({
      subtotal: s.subtotal + inv.subtotal,
      tax: s.tax + inv.tax_amount,
      total: s.total + inv.total,
      paid: s.paid + inv.amount_paid,
    }), { subtotal: 0, tax: 0, total: 0, paid: 0 });
  }

  exportCSV() {
    const header = ['Factura','Cliente','NCF','Estado','Fecha','Subtotal','ITBIS','Total','Pagado'];
    const rows = this.filteredInvoices.map(inv => [
      inv.invoice_number, inv.client?.name ?? '', inv.ncf ?? '', inv.status,
      inv.issue_date, inv.subtotal.toFixed(2), inv.tax_amount.toFixed(2),
      inv.total.toFixed(2), inv.amount_paid.toFixed(2),
    ]);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `reporte_${this.selectedYear}_${String(this.selectedMonth).padStart(2,'0')}.csv`;
    a.click();
  }
}
