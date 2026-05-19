import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../services/i18n.service';
import { DataService } from '../../services/data.service';
import { PermissionsService } from '../../services/permissions.service';
import { ModalComponent } from '../../components/modal.component';
import { ProductService } from '../../services/supabase.service';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  template: `
<div class="space-y-4">
  <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
    <input [(ngModel)]="search" type="text" [placeholder]="i18n.t('search')"
      class="w-full sm:w-72 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
    <button *ngIf="perms.canCreate('products')" (click)="openCreate()"
      class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      {{i18n.t('new_product')}}
    </button>
  </div>

  <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-800/50">
          <tr>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('code')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('name')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">{{i18n.t('type')}}</th>
            <th class="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('price')}}</th>
            <th class="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">{{i18n.t('tax_rate')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('status')}}</th>
            <th class="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr *ngFor="let p of filtered" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <td class="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-400">{{p.code}}</td>
            <td class="px-6 py-4">
              <div class="text-sm font-medium text-gray-900 dark:text-white">{{p.name}}</div>
              <div class="text-xs text-gray-400 truncate max-w-xs">{{p.description}}</div>
            </td>
            <td class="px-6 py-4 hidden md:table-cell">
              <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">{{i18n.t(p.type)}}</span>
            </td>
            <td class="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">{{data.formatCurrency(p.unit_price)}}</td>
            <td class="px-6 py-4 text-right text-sm text-gray-600 dark:text-gray-400 hidden lg:table-cell">{{p.tax_rate ? p.tax_rate.rate + '%' : '—'}}</td>
            <td class="px-6 py-4">
              <span [class]="'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ' + (p.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500')">{{i18n.t(p.is_active ? 'active' : 'inactive')}}</span>
            </td>
            <td class="px-6 py-4">
              <div class="flex gap-2 justify-end">
                <button *ngIf="perms.canEdit('products')" (click)="openEdit(p)" class="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
              </div>
            </td>
          </tr>
          <tr *ngIf="!filtered.length"><td colspan="7" class="text-center py-12 text-gray-400">{{i18n.t('no_data')}}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<app-modal [isOpen]="showModal" [title]="editing ? i18n.t('edit') : i18n.t('new_product')" (close)="showModal = false">
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('code')}}</label><input [(ngModel)]="form.code" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
      <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('type')}}</label>
        <select [(ngModel)]="form.type" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
          <option value="product">{{i18n.t('product')}}</option><option value="service">{{i18n.t('service')}}</option>
        </select></div>
      <div class="col-span-2"><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('name')}} *</label><input [(ngModel)]="form.name" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
      <div class="col-span-2"><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('description')}}</label><textarea [(ngModel)]="form.description" rows="2" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none resize-none"></textarea></div>
      <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('price')}}</label><input [(ngModel)]="form.unit_price" type="number" step="0.01" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
      <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('unit')}}</label><input [(ngModel)]="form.unit" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
      <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('tax_rate')}}</label>
        <select [(ngModel)]="form.tax_rate_id" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
          <option value="">—</option><option *ngFor="let t of data.taxRates()" [value]="t.id">{{t.name}} ({{t.rate}}%)</option>
        </select></div>
      <div class="flex items-center gap-2 mt-4"><input [(ngModel)]="form.is_active" type="checkbox" id="prodActive" class="rounded"><label for="prodActive" class="text-sm text-gray-700 dark:text-gray-300">{{i18n.t('active')}}</label></div>
    </div>
    <div class="flex gap-3 justify-end pt-2">
      <button (click)="showModal = false" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">{{i18n.t('cancel')}}</button>
      <button (click)="save()" [disabled]="saving" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl">{{saving ? i18n.t('loading') : i18n.t('save')}}</button>
    </div>
  </div>
</app-modal>
  `
})
export class ProductsComponent implements OnInit {
  search = '';
  showModal = false;
  editing: ProductService | null = null;
  saving = false;
  form = this.blank();

  constructor(public i18n: I18nService, public data: DataService, public perms: PermissionsService) {}
  ngOnInit() { this.data.loadProducts(); this.data.loadTaxRates(); }

  get filtered() {
    const q = this.search.toLowerCase();
    return this.data.products().filter(p => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  }

  blank() { return { code: '', name: '', description: '', type: 'product' as 'product' | 'service', unit_price: 0, unit: '', tax_rate_id: null as string | null, is_active: true }; }
  openCreate() { this.editing = null; this.form = this.blank(); this.showModal = true; }
  openEdit(p: ProductService) { this.editing = p; this.form = { code: p.code, name: p.name, description: p.description, type: p.type, unit_price: p.unit_price, unit: p.unit, tax_rate_id: p.tax_rate_id, is_active: p.is_active }; this.showModal = true; }

  async save() {
    this.saving = true;
    if (this.editing) {
      await this.data.db.from('products_services').update({ ...this.form, updated_at: new Date().toISOString() }).eq('id', this.editing.id);
    } else {
      await this.data.db.from('products_services').insert(this.form);
    }
    await this.data.loadProducts();
    this.saving = false; this.showModal = false;
  }
}
