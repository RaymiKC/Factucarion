import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../services/i18n.service';
import { DataService } from '../../services/data.service';
import { PermissionsService } from '../../services/permissions.service';
import { CompanyService } from '../../services/company.service';
import { ModalComponent } from '../../components/modal.component';
import { Invoice, InvoiceItem, Client, ProductService, TaxRate } from '../../services/models';

interface InvoiceItemForm { description: string; quantity: number; unit_price: number; tax_rate: number; discount_percent: number; product_id: string | null; }

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  template: `
<div class="space-y-4">
  <!-- Filters -->
  <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
    <div class="flex gap-2 flex-wrap">
      <input [(ngModel)]="search" type="text" [placeholder]="i18n.t('search')"
        class="w-full sm:w-64 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
      <select [(ngModel)]="statusFilter" class="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
        <option value="">{{i18n.t('status')}}: {{i18n.t('filter')}}</option>
        <option *ngFor="let s of statuses" [value]="s">{{i18n.t(s)}}</option>
      </select>
    </div>
    <button *ngIf="perms.canCreate('invoices')" (click)="openCreate()"
      class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl whitespace-nowrap">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      {{i18n.t('new_invoice')}}
    </button>
  </div>

  <!-- Table -->
  <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-800/50">
          <tr>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('invoice_number')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('client')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">{{i18n.t('issue_date')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">{{i18n.t('due_date')}}</th>
            <th class="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('total')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{{i18n.t('status')}}</th>
            <th class="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr *ngFor="let inv of filteredInvoices" class="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" (click)="viewInvoice(inv)">
            <td class="px-6 py-4">
              <div class="text-sm font-medium text-gray-900 dark:text-white">{{inv.invoice_number}}</div>
              <div *ngIf="inv.ncf" class="text-xs font-mono text-gray-400">{{inv.ncf}}</div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{{inv.client?.name ?? '—'}}</td>
            <td class="px-6 py-4 text-sm text-gray-500 hidden lg:table-cell">{{data.formatDate(inv.issue_date)}}</td>
            <td class="px-6 py-4 text-sm hidden lg:table-cell" [class]="isDueSoon(inv) ? 'text-red-500 font-medium' : 'text-gray-500'">{{inv.due_date ? data.formatDate(inv.due_date) : '—'}}</td>
            <td class="px-6 py-4 text-right">
              <div class="text-sm font-bold text-gray-900 dark:text-white">{{data.formatCurrency(inv.total, inv.currency)}}</div>
              <div *ngIf="inv.amount_paid > 0 && inv.amount_paid < inv.total" class="text-xs text-gray-400">Pagado: {{data.formatCurrency(inv.amount_paid, inv.currency)}}</div>
            </td>
            <td class="px-6 py-4">
              <span [class]="'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ' + data.getStatusColor(inv.status)">{{i18n.t(inv.status)}}</span>
            </td>
            <td class="px-6 py-4" (click)="$event.stopPropagation()">
              <div class="flex gap-1 justify-end">
                <button *ngIf="perms.canEdit('invoices') && inv.status !== 'paid' && inv.status !== 'void'" (click)="markPaid(inv)" class="p-1.5 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20" title="{{i18n.t('mark_paid')}}">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                </button>
                <button *ngIf="perms.canEdit('invoices')" (click)="openEdit(inv)" class="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
              </div>
            </td>
          </tr>
          <tr *ngIf="!filteredInvoices.length"><td colspan="7" class="text-center py-12 text-gray-400">{{i18n.t('no_data')}}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- Invoice Form Modal -->
<app-modal [isOpen]="showModal" [title]="editing ? i18n.t('edit') + ' ' + i18n.t('invoices') : i18n.t('new_invoice')" (close)="showModal = false">
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('client')}}</label>
        <select [(ngModel)]="form.client_id" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
          <option value="">— Sin cliente —</option>
          <option *ngFor="let c of activeClients" [value]="c.id">{{c.name}}</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('status')}}</label>
        <select [(ngModel)]="form.status" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
          <option *ngFor="let s of statuses" [value]="s">{{i18n.t(s)}}</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('issue_date')}}</label>
        <input [(ngModel)]="form.issue_date" type="date" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('due_date')}}</label>
        <input [(ngModel)]="form.due_date" type="date" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('currency')}}</label>
        <select [(ngModel)]="form.currency" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
          <option value="DOP">DOP — RD$</option><option value="USD">USD — $</option><option value="EUR">EUR — €</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NCF</label>
        <input [(ngModel)]="form.ncf" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
      </div>
    </div>

    <!-- Items -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{i18n.t('items')}}</label>
        <button (click)="addItem()" type="button" class="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ {{i18n.t('add_item')}}</button>
      </div>
      <div class="space-y-2">
        <div *ngFor="let item of formItems; let i = index" class="grid grid-cols-12 gap-2 items-center">
          <input [(ngModel)]="item.description" type="text" placeholder="Descripción" class="col-span-4 px-2 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none">
          <input [(ngModel)]="item.quantity" type="number" placeholder="Cant" class="col-span-2 px-2 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none">
          <input [(ngModel)]="item.unit_price" type="number" placeholder="Precio" step="0.01" class="col-span-2 px-2 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none">
          <input [(ngModel)]="item.tax_rate" type="number" placeholder="%" class="col-span-2 px-2 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none">
          <div class="col-span-1 text-right text-xs font-medium text-gray-900 dark:text-white">{{data.formatCurrency(itemTotal(item))}}</div>
          <button (click)="removeItem(i)" type="button" class="col-span-1 text-gray-400 hover:text-red-500 text-center">×</button>
        </div>
      </div>
      <!-- Totals -->
      <div class="mt-4 space-y-1 text-sm border-t pt-3">
        <div class="flex justify-between text-gray-600 dark:text-gray-400"><span>{{i18n.t('subtotal')}}</span><span>{{data.formatCurrency(calcSubtotal())}}</span></div>
        <div class="flex justify-between text-gray-600 dark:text-gray-400"><span>ITBIS</span><span>{{data.formatCurrency(calcTax())}}</span></div>
        <div class="flex justify-between font-bold text-gray-900 dark:text-white text-base"><span>{{i18n.t('total')}}</span><span>{{data.formatCurrency(calcTotal())}}</span></div>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('notes')}}</label>
      <textarea [(ngModel)]="form.notes" rows="2" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none resize-none"></textarea>
    </div>

    <div *ngIf="formError" class="text-red-500 text-sm">{{formError}}</div>
    <div class="flex gap-3 justify-end pt-2">
      <button (click)="showModal = false" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">{{i18n.t('cancel')}}</button>
      <button (click)="save()" [disabled]="saving" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl">{{saving ? i18n.t('loading') : i18n.t('save')}}</button>
    </div>
  </div>
</app-modal>

<!-- Invoice Detail Modal -->
<app-modal *ngIf="viewingInvoice" [isOpen]="!!viewingInvoice" [title]="viewingInvoice.invoice_number" (close)="viewingInvoice = null">
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-3 text-sm">
      <div><span class="text-gray-500">{{i18n.t('client')}}:</span> <span class="font-medium text-gray-900 dark:text-white">{{viewingInvoice.client?.name ?? '—'}}</span></div>
      <div><span class="text-gray-500">{{i18n.t('status')}}:</span> <span [class]="'ml-1 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ' + data.getStatusColor(viewingInvoice.status)">{{i18n.t(viewingInvoice.status)}}</span></div>
      <div><span class="text-gray-500">{{i18n.t('issue_date')}}:</span> <span class="text-gray-900 dark:text-white">{{data.formatDate(viewingInvoice.issue_date)}}</span></div>
      <div><span class="text-gray-500">{{i18n.t('due_date')}}:</span> <span class="text-gray-900 dark:text-white">{{viewingInvoice.due_date ? data.formatDate(viewingInvoice.due_date) : '—'}}</span></div>
      <div><span class="text-gray-500">NCF:</span> <span class="font-mono text-gray-900 dark:text-white">{{viewingInvoice.ncf || '—'}}</span></div>
      <div><span class="text-gray-500">{{i18n.t('currency')}}:</span> <span class="text-gray-900 dark:text-white">{{viewingInvoice.currency}}</span></div>
    </div>
    <table class="w-full text-sm border-t pt-3">
      <thead><tr class="text-xs font-semibold text-gray-500 uppercase"><th class="text-left pb-2">{{i18n.t('description')}}</th><th class="text-right pb-2">Cant</th><th class="text-right pb-2">Precio</th><th class="text-right pb-2">{{i18n.t('total')}}</th></tr></thead>
      <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
        <tr *ngFor="let item of viewingInvoice.items ?? []" class="text-gray-900 dark:text-white">
          <td class="py-2">{{item.description}}</td>
          <td class="py-2 text-right text-gray-600">{{item.quantity}}</td>
          <td class="py-2 text-right text-gray-600">{{data.formatCurrency(item.unit_price, viewingInvoice.currency)}}</td>
          <td class="py-2 text-right font-medium">{{data.formatCurrency(item.line_total, viewingInvoice.currency)}}</td>
        </tr>
      </tbody>
    </table>
    <div class="space-y-1 text-sm border-t pt-3">
      <div class="flex justify-between text-gray-600 dark:text-gray-400"><span>{{i18n.t('subtotal')}}</span><span>{{data.formatCurrency(viewingInvoice.subtotal, viewingInvoice.currency)}}</span></div>
      <div class="flex justify-between text-gray-600 dark:text-gray-400"><span>ITBIS</span><span>{{data.formatCurrency(viewingInvoice.tax_amount, viewingInvoice.currency)}}</span></div>
      <div class="flex justify-between font-bold text-lg text-gray-900 dark:text-white"><span>{{i18n.t('total')}}</span><span>{{data.formatCurrency(viewingInvoice.total, viewingInvoice.currency)}}</span></div>
    </div>
    <div *ngIf="viewingInvoice.notes" class="text-sm text-gray-500 dark:text-gray-400 italic">{{viewingInvoice.notes}}</div>
  </div>
</app-modal>
  `
})
export class InvoicesComponent implements OnInit {
  search = '';
  statusFilter = '';
  showModal = false;
  editing: Invoice | null = null;
  viewingInvoice: (Invoice & { items?: InvoiceItem[] }) | null = null;
  saving = false;
  formError = '';
  statuses = ['draft','sent','paid','partial','overdue','cancelled','void'];
  form = this.blankForm();
  formItems: InvoiceItemForm[] = [];

  constructor(public i18n: I18nService, public data: DataService, public perms: PermissionsService, private company: CompanyService) {}

  ngOnInit() {
    const cid = this.company.currentCompany()?.id;
    this.data.loadInvoices(cid);
    this.data.loadClients(cid);
    this.data.loadProducts();
    this.data.loadTaxRates();
  }

  get activeClients() { return this.data.clients().filter(c => c.is_active); }

  get filteredInvoices() {
    const q = this.search.toLowerCase();
    return this.data.invoices().filter(inv => {
      const matchQ = !q || inv.invoice_number.toLowerCase().includes(q) || (inv.client?.name ?? '').toLowerCase().includes(q) || (inv.ncf ?? '').includes(q);
      const matchS = !this.statusFilter || inv.status === this.statusFilter;
      return matchQ && matchS;
    });
  }

  isDueSoon(inv: Invoice): boolean {
    if (!inv.due_date || inv.status === 'paid' || inv.status === 'void') return false;
    const due = new Date(inv.due_date);
    const diff = (due.getTime() - Date.now()) / 86400000;
    return diff < 7;
  }

  blankForm() { return { client_id: '' as string | null, status: 'draft' as Invoice['status'], issue_date: new Date().toISOString().split('T')[0], due_date: '', currency: 'DOP', ncf: '', notes: '', terms: '' }; }

  openCreate() {
    this.editing = null;
    this.form = this.blankForm();
    this.formItems = [{ description: '', quantity: 1, unit_price: 0, tax_rate: 18, discount_percent: 0, product_id: null }];
    this.formError = '';
    this.showModal = true;
  }

  openEdit(inv: Invoice) {
    this.editing = inv;
    this.form = { client_id: inv.client_id, status: inv.status, issue_date: inv.issue_date, due_date: inv.due_date ?? '', currency: inv.currency, ncf: inv.ncf ?? '', notes: inv.notes ?? '', terms: inv.terms ?? '' };
    this.formItems = (inv.items ?? []).map(it => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price, tax_rate: it.tax_rate, discount_percent: it.discount_percent, product_id: it.product_id }));
    if (!this.formItems.length) this.formItems = [{ description: '', quantity: 1, unit_price: 0, tax_rate: 18, discount_percent: 0, product_id: null }];
    this.formError = '';
    this.showModal = true;
  }

  async viewInvoice(inv: Invoice) {
    const { data } = await this.data.db.from('invoices').select('*, client:clients(*), items:invoice_items(*)').eq('id', inv.id).single();
    this.viewingInvoice = data;
  }

  addItem() { this.formItems.push({ description: '', quantity: 1, unit_price: 0, tax_rate: 18, discount_percent: 0, product_id: null }); }
  removeItem(i: number) { this.formItems.splice(i, 1); }

  itemTotal(item: InvoiceItemForm): number {
    const sub = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
    return sub * (1 + item.tax_rate / 100);
  }

  calcSubtotal() { return this.formItems.reduce((s, it) => s + it.quantity * it.unit_price * (1 - it.discount_percent / 100), 0); }
  calcTax() { return this.formItems.reduce((s, it) => { const sub = it.quantity * it.unit_price * (1 - it.discount_percent / 100); return s + sub * (it.tax_rate / 100); }, 0); }
  calcTotal() { return this.calcSubtotal() + this.calcTax(); }

  async save() {
    this.saving = true; this.formError = '';
    const companyId = this.company.currentCompany()?.id;
    const subtotal = this.calcSubtotal();
    const taxAmount = this.calcTax();
    const total = this.calcTotal();

    const invData = {
      ...this.form,
      client_id: this.form.client_id || null,
      due_date: this.form.due_date || null,
      subtotal, tax_amount: taxAmount, discount_amount: 0, total, amount_paid: 0,
      exchange_rate: 1, is_electronic: false, electronic_status: 'pending' as const,
      electronic_id: '', electronic_response: null, sent_at: null,
      company_id: companyId, updated_at: new Date().toISOString(),
    };

    if (this.editing) {
      await this.data.db.from('invoices').update(invData).eq('id', this.editing.id);
      await this.data.db.from('invoice_items').delete().eq('invoice_id', this.editing.id);
      if (this.formItems.length) {
        await this.data.db.from('invoice_items').insert(this.formItems.map((it, idx) => ({
          invoice_id: this.editing!.id, ...it, tax_amount: it.quantity * it.unit_price * it.tax_rate / 100, discount_amount: 0, line_total: this.itemTotal(it), sort_order: idx,
        })));
      }
    } else {
      const num = `INV-${Date.now()}`;
      const { data: newInv } = await this.data.db.from('invoices').insert({ ...invData, invoice_number: num, invoice_type: 'one_time', recurrence_rule: null, recurrence_end: null, parent_invoice_id: null, ncf_type: '' }).select().single();
      if (newInv && this.formItems.length) {
        await this.data.db.from('invoice_items').insert(this.formItems.map((it, idx) => ({
          invoice_id: newInv.id, ...it, tax_amount: it.quantity * it.unit_price * it.tax_rate / 100, discount_amount: 0, line_total: this.itemTotal(it), sort_order: idx,
        })));
      }
    }

    await this.data.loadInvoices(companyId);
    this.saving = false;
    this.showModal = false;
  }

  async markPaid(inv: Invoice) {
    await this.data.db.from('invoices').update({ status: 'paid', amount_paid: inv.total, payment_date: new Date().toISOString().split('T')[0] }).eq('id', inv.id);
    await this.data.loadInvoices(this.company.currentCompany()?.id);
  }
}
