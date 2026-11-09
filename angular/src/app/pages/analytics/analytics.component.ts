import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../services/i18n.service';
import { DataService } from '../../services/data.service';
import { CompanyService } from '../../services/company.service';
import { DbService } from '../../services/db.service';

interface Expense { id: string; amount: number; category: string; description: string; date: string; company_id?: string; }

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="space-y-6">
  <!-- KPI row -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800">
      <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">{{i18n.t('revenue')}}</p>
      <p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{{data.formatCurrency(totalRevenue)}}</p>
    </div>
    <div class="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800">
      <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">{{i18n.t('expenses')}}</p>
      <p class="text-2xl font-bold text-red-500 mt-1">{{data.formatCurrency(totalExpenses)}}</p>
    </div>
    <div class="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800">
      <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">{{i18n.t('profit')}}</p>
      <p [class]="'text-2xl font-bold mt-1 ' + (profit >= 0 ? 'text-green-600' : 'text-red-500')">{{data.formatCurrency(profit)}}</p>
    </div>
    <div class="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800">
      <p class="text-xs text-gray-500 font-medium uppercase tracking-wider">Margen</p>
      <p [class]="'text-2xl font-bold mt-1 ' + (margin >= 0 ? 'text-green-600' : 'text-red-500')">{{margin.toFixed(1)}}%</p>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Monthly chart -->
    <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
      <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-4">{{i18n.t('revenue')}} vs {{i18n.t('expenses')}}</h3>
      <div class="flex items-end gap-2 h-48">
        <div *ngFor="let m of monthlyChart" class="flex-1 flex flex-col items-center gap-0.5">
          <div class="w-full flex gap-0.5 items-end">
            <div class="flex-1 bg-blue-500 rounded-t-sm" [style.height]="m.revH + 'px'" [title]="data.formatCurrency(m.rev)"></div>
            <div class="flex-1 bg-red-400 rounded-t-sm" [style.height]="m.expH + 'px'" [title]="data.formatCurrency(m.exp)"></div>
          </div>
          <span class="text-xs text-gray-500">{{m.month}}</span>
        </div>
      </div>
      <div class="flex gap-4 mt-3">
        <div class="flex items-center gap-1.5"><div class="w-3 h-3 bg-blue-500 rounded-sm"></div><span class="text-xs text-gray-500">{{i18n.t('revenue')}}</span></div>
        <div class="flex items-center gap-1.5"><div class="w-3 h-3 bg-red-400 rounded-sm"></div><span class="text-xs text-gray-500">{{i18n.t('expenses')}}</span></div>
      </div>
    </div>

    <!-- Expense categories -->
    <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
      <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-4">{{i18n.t('expense_category')}}</h3>
      <div class="space-y-3">
        <div *ngFor="let cat of expenseByCategory" class="space-y-1">
          <div class="flex justify-between text-sm">
            <span class="text-gray-700 dark:text-gray-300">{{cat.category}}</span>
            <span class="font-medium text-gray-900 dark:text-white">{{data.formatCurrency(cat.amount)}}</span>
          </div>
          <div class="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div class="h-full bg-blue-500 rounded-full" [style.width]="(cat.amount / (totalExpenses || 1) * 100) + '%'"></div>
          </div>
        </div>
        <p *ngIf="!expenseByCategory.length" class="text-sm text-gray-400 text-center py-4">{{i18n.t('no_data')}}</p>
      </div>
    </div>
  </div>

  <!-- Expenses table -->
  <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
      <h3 class="font-semibold text-gray-900 dark:text-white text-sm">{{i18n.t('expenses')}}</h3>
      <button (click)="showAddExpense = true" class="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl">+ Agregar</button>
    </div>
    <div *ngIf="showAddExpense" class="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <input [(ngModel)]="newExp.description" placeholder="Descripción" type="text" class="px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
        <input [(ngModel)]="newExp.category" placeholder="Categoría" type="text" class="px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
        <input [(ngModel)]="newExp.amount" placeholder="Monto" type="number" class="px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
        <input [(ngModel)]="newExp.date" type="date" class="px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
      </div>
      <div class="flex gap-2 mt-3">
        <button (click)="addExpense()" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl">{{i18n.t('save')}}</button>
        <button (click)="showAddExpense = false" class="px-3 py-1.5 text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm rounded-xl">{{i18n.t('cancel')}}</button>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-800/50">
          <tr>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('date')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('description')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('expense_category')}}</th>
            <th class="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('amount')}}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr *ngFor="let e of expenses" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <td class="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">{{data.formatDate(e.date)}}</td>
            <td class="px-6 py-3 text-sm text-gray-900 dark:text-white">{{e.description}}</td>
            <td class="px-6 py-3"><span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-700 dark:text-gray-300">{{e.category}}</span></td>
            <td class="px-6 py-3 text-right text-sm font-semibold text-red-500">{{data.formatCurrency(e.amount)}}</td>
          </tr>
          <tr *ngIf="!expenses.length"><td colspan="4" class="text-center py-8 text-gray-400">{{i18n.t('no_data')}}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
  `
})
export class AnalyticsComponent implements OnInit {
  expenses: Expense[] = [];
  showAddExpense = false;
  newExp = { description: '', category: '', amount: 0, date: new Date().toISOString().split('T')[0] };

  constructor(public i18n: I18nService, public data: DataService, private company: CompanyService, private db: DbService) {}

  ngOnInit() {
    this.data.loadInvoices(this.company.currentCompany()?.id);
    this.loadExpenses();
  }

  async loadExpenses() {
    const { data } = await this.db.client.from('expenses').select('*').order('date', { ascending: false });
    this.expenses = data ?? [];
  }

  get totalRevenue() { return this.data.invoices().filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0); }
  get totalExpenses() { return this.expenses.reduce((s, e) => s + e.amount, 0); }
  get profit() { return this.totalRevenue - this.totalExpenses; }
  get margin() { return this.totalRevenue > 0 ? (this.profit / this.totalRevenue) * 100 : 0; }

  get expenseByCategory() {
    const map: Record<string, number> = {};
    for (const e of this.expenses) map[e.category] = (map[e.category] ?? 0) + e.amount;
    return Object.entries(map).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }

  get monthlyChart() {
    const now = new Date();
    const data: { month: string; rev: number; exp: number; revH: number; expH: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth(); const y = d.getFullYear();
      const rev = this.data.invoices().filter(inv => inv.status === 'paid' && inv.payment_date && new Date(inv.payment_date).getMonth() === m && new Date(inv.payment_date).getFullYear() === y).reduce((s, inv) => s + inv.total, 0);
      const exp = this.expenses.filter(e => { const ed = new Date(e.date); return ed.getMonth() === m && ed.getFullYear() === y; }).reduce((s, e) => s + e.amount, 0);
      data.push({ month: d.toLocaleString('default', { month: 'short' }), rev, exp, revH: 0, expH: 0 });
    }
    const maxVal = Math.max(...data.map(d => Math.max(d.rev, d.exp)), 1);
    return data.map(d => ({ ...d, revH: Math.max(4, (d.rev / maxVal) * 160), expH: Math.max(4, (d.exp / maxVal) * 160) }));
  }

  async addExpense() {
    if (!this.newExp.description || !this.newExp.amount) return;
    const companyId = this.company.currentCompany()?.id;
    await this.db.client.from('expenses').insert({ ...this.newExp, company_id: companyId });
    this.showAddExpense = false;
    this.newExp = { description: '', category: '', amount: 0, date: new Date().toISOString().split('T')[0] };
    await this.loadExpenses();
  }
}
