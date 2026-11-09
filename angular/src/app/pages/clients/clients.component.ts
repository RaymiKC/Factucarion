import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../services/i18n.service';
import { DataService } from '../../services/data.service';
import { PermissionsService } from '../../services/permissions.service';
import { CompanyService } from '../../services/company.service';
import { ModalComponent } from '../../components/modal.component';
import { Client } from '../../services/models';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  template: `
<div class="space-y-4">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
    <input [(ngModel)]="search" type="text" [placeholder]="i18n.t('search')"
      class="w-full sm:w-72 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
    <button *ngIf="perms.canCreate('clients')" (click)="openCreate()"
      class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      {{i18n.t('new_client')}}
    </button>
  </div>

  <!-- Table -->
  <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-800/50">
          <tr>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{i18n.t('name')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">{{i18n.t('email')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">{{i18n.t('type')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">{{i18n.t('phone')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{i18n.t('status')}}</th>
            <th class="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr *ngFor="let client of filteredClients" class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <td class="px-6 py-4">
              <div class="font-medium text-gray-900 dark:text-white text-sm">{{client.name}}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">{{client.rnc || client.cedula}}</div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">{{client.email}}</td>
            <td class="px-6 py-4 hidden lg:table-cell">
              <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">{{i18n.t(client.client_type)}}</span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 hidden lg:table-cell">{{client.phone}}</td>
            <td class="px-6 py-4">
              <span [class]="'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ' + (client.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400')">
                {{i18n.t(client.is_active ? 'active' : 'inactive')}}
              </span>
            </td>
            <td class="px-6 py-4">
              <div class="flex gap-2 justify-end">
                <button *ngIf="perms.canEdit('clients')" (click)="openEdit(client)" class="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button *ngIf="perms.canDelete('clients')" (click)="confirmDelete(client)" class="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </td>
          </tr>
          <tr *ngIf="!filteredClients.length"><td colspan="6" class="text-center py-12 text-gray-400">{{i18n.t('no_data')}}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- Create/Edit Modal -->
<app-modal [isOpen]="showModal" [title]="editing ? i18n.t('edit') + ' ' + i18n.t('client') : i18n.t('new_client')" (close)="showModal = false">
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div class="col-span-2">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('name')}} *</label>
        <input [(ngModel)]="form.name" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('type')}}</label>
        <select [(ngModel)]="form.client_type" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
          <option value="business">{{i18n.t('business')}}</option>
          <option value="person">{{i18n.t('person')}}</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{form.client_type === 'business' ? i18n.t('rnc') : i18n.t('cedula')}}</label>
        <input [(ngModel)]="form.rnc" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('email')}}</label>
        <input [(ngModel)]="form.email" type="email" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('phone')}}</label>
        <input [(ngModel)]="form.phone" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
      </div>
      <div class="col-span-2">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('address')}}</label>
        <input [(ngModel)]="form.address" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('city')}}</label>
        <input [(ngModel)]="form.city" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('payment_terms')}} ({{i18n.t('days')}})</label>
        <input [(ngModel)]="form.payment_terms" type="number" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
      </div>
      <div class="col-span-2">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('notes')}}</label>
        <textarea [(ngModel)]="form.notes" rows="2" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none resize-none"></textarea>
      </div>
      <div class="col-span-2 flex items-center gap-2">
        <input [(ngModel)]="form.is_active" type="checkbox" id="clientActive" class="rounded border-gray-300">
        <label for="clientActive" class="text-sm text-gray-700 dark:text-gray-300">{{i18n.t('active')}}</label>
      </div>
    </div>
    <div *ngIf="formError" class="text-red-500 text-sm">{{formError}}</div>
    <div class="flex gap-3 justify-end pt-2">
      <button (click)="showModal = false" class="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">{{i18n.t('cancel')}}</button>
      <button (click)="save()" [disabled]="saving" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors">{{saving ? i18n.t('loading') : i18n.t('save')}}</button>
    </div>
  </div>
</app-modal>

<!-- Delete confirm -->
<app-modal [isOpen]="showDeleteModal" [title]="i18n.t('confirm')" (close)="showDeleteModal = false">
  <p class="text-gray-700 dark:text-gray-300 mb-6">¿Desactivar este cliente?</p>
  <div class="flex gap-3 justify-end">
    <button (click)="showDeleteModal = false" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">{{i18n.t('cancel')}}</button>
    <button (click)="deactivate()" class="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-xl">{{i18n.t('confirm')}}</button>
  </div>
</app-modal>
  `
})
export class ClientsComponent implements OnInit {
  search = '';
  showModal = false;
  showDeleteModal = false;
  editing: Client | null = null;
  deleteTarget: Client | null = null;
  saving = false;
  formError = '';
  form = this.blankForm();

  constructor(public i18n: I18nService, public data: DataService, public perms: PermissionsService, private company: CompanyService) {}
  ngOnInit() { this.data.loadClients(this.company.currentCompany()?.id); }

  get filteredClients() {
    const q = this.search.toLowerCase();
    return this.data.clients().filter(c => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.rnc?.includes(q) || c.cedula?.includes(q));
  }

  blankForm() { return { name: '', email: '', phone: '', rnc: '', cedula: '', address: '', city: '', country: '', client_type: 'business' as 'business' | 'person', payment_terms: 30, credit_limit: 0, notes: '', is_active: true, email_list: '', email_body_template: '' }; }

  openCreate() { this.editing = null; this.form = this.blankForm(); this.formError = ''; this.showModal = true; }
  openEdit(c: Client) { this.editing = c; this.form = { ...c }; this.formError = ''; this.showModal = true; }
  confirmDelete(c: Client) { this.deleteTarget = c; this.showDeleteModal = true; }

  async save() {
    if (!this.form.name) { this.formError = this.i18n.t('name') + ' requerido'; return; }
    this.saving = true; this.formError = '';
    const companyId = this.company.currentCompany()?.id;
    if (this.editing) {
      await this.data.db.from('clients').update({ ...this.form, updated_at: new Date().toISOString() }).eq('id', this.editing.id);
    } else {
      await this.data.db.from('clients').insert({ ...this.form, company_id: companyId });
    }
    await this.data.loadClients(companyId);
    this.saving = false; this.showModal = false;
  }

  async deactivate() {
    if (!this.deleteTarget) return;
    await this.data.db.from('clients').update({ is_active: false }).eq('id', this.deleteTarget.id);
    await this.data.loadClients(this.company.currentCompany()?.id);
    this.showDeleteModal = false;
  }
}
