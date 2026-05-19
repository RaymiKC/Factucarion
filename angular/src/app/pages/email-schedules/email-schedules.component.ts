import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../services/i18n.service';
import { DataService } from '../../services/data.service';
import { PermissionsService } from '../../services/permissions.service';
import { ModalComponent } from '../../components/modal.component';
import { EmailSchedule } from '../../services/supabase.service';

@Component({
  selector: 'app-email-schedules',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  template: `
<div class="space-y-4">
  <div class="flex justify-between items-center">
    <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{i18n.t('email_schedules')}}</h2>
    <button *ngIf="perms.canCreate('email_schedules')" (click)="openCreate()" class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
      Nuevo
    </button>
  </div>

  <div class="grid gap-4">
    <div *ngFor="let s of data.emailSchedules()" class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="font-medium text-gray-900 dark:text-white text-sm">{{s.name}}</h3>
            <span [class]="'inline-flex px-2 py-0.5 rounded-full text-xs font-medium ' + (s.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500')">{{i18n.t(s.is_active ? 'active' : 'inactive')}}</span>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{s.trigger_event}} · {{s.days_offset > 0 ? '+' : ''}}{{s.days_offset}} {{i18n.t('days')}}</p>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">{{s.subject}}</p>
        </div>
        <div class="flex gap-2 ml-3">
          <button *ngIf="perms.canEdit('email_schedules')" (click)="openEdit(s)" class="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
        </div>
      </div>
    </div>
    <p *ngIf="!data.emailSchedules().length" class="text-center py-12 text-gray-400">{{i18n.t('no_data')}}</p>
  </div>

  <!-- Log section -->
  <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 mt-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-medium text-gray-900 dark:text-white text-sm">{{i18n.t('email_log')}}</h3>
      <button (click)="loadLog()" class="text-xs text-blue-600 dark:text-blue-400 hover:underline">{{i18n.t('filter')}}</button>
    </div>
    <div class="space-y-2 max-h-64 overflow-y-auto">
      <div *ngFor="let log of data.emailLog()" class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 text-sm">
        <div class="flex-1 min-w-0">
          <p class="font-medium text-gray-900 dark:text-white truncate">{{log.to_email}}</p>
          <p class="text-xs text-gray-500 truncate">{{log.subject}}</p>
        </div>
        <span [class]="'ml-3 shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ' + (log.status === 'sent' ? 'bg-green-100 text-green-800' : log.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800')">{{log.status}}</span>
      </div>
      <p *ngIf="!data.emailLog().length" class="text-center py-4 text-xs text-gray-400">Sin registros</p>
    </div>
  </div>
</div>

<app-modal [isOpen]="showModal" [title]="editing ? i18n.t('edit') : 'Nueva Programación'" (close)="showModal = false">
  <div class="space-y-4">
    <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('name')}}</label><input [(ngModel)]="form.name" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
    <div class="grid grid-cols-2 gap-4">
      <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('trigger')}}</label>
        <select [(ngModel)]="form.trigger_event" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
          <option value="invoice_due">Vencimiento</option><option value="overdue">Vencida</option><option value="payment_reminder">Recordatorio</option><option value="custom">Personalizado</option>
        </select></div>
      <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('days_offset')}}</label><input [(ngModel)]="form.days_offset" type="number" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
    </div>
    <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('subject')}}</label><input [(ngModel)]="form.subject" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
    <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('body')}}</label><textarea [(ngModel)]="form.body_template" rows="4" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none resize-none"></textarea></div>
    <div class="flex items-center gap-2"><input [(ngModel)]="form.is_active" type="checkbox" id="scheduleActive" class="rounded"><label for="scheduleActive" class="text-sm text-gray-700 dark:text-gray-300">{{i18n.t('active')}}</label></div>
    <div class="flex gap-3 justify-end pt-2">
      <button (click)="showModal = false" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">{{i18n.t('cancel')}}</button>
      <button (click)="save()" [disabled]="saving" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl">{{saving ? i18n.t('loading') : i18n.t('save')}}</button>
    </div>
  </div>
</app-modal>
  `
})
export class EmailSchedulesComponent implements OnInit {
  showModal = false;
  editing: EmailSchedule | null = null;
  saving = false;
  form = this.blank();

  constructor(public i18n: I18nService, public data: DataService, public perms: PermissionsService) {}
  ngOnInit() { this.data.loadEmailSchedules(); this.loadLog(); }
  loadLog() { this.data.loadEmailLog(); }

  blank() { return { name: '', trigger_event: 'invoice_due', days_offset: 0, subject: '', body_template: '', is_active: true }; }
  openCreate() { this.editing = null; this.form = this.blank(); this.showModal = true; }
  openEdit(s: EmailSchedule) { this.editing = s; this.form = { name: s.name, trigger_event: s.trigger_event, days_offset: s.days_offset, subject: s.subject, body_template: s.body_template, is_active: s.is_active }; this.showModal = true; }

  async save() {
    this.saving = true;
    if (this.editing) {
      await this.data.db.from('email_schedules').update({ ...this.form, updated_at: new Date().toISOString() }).eq('id', this.editing.id);
    } else {
      await this.data.db.from('email_schedules').insert(this.form);
    }
    await this.data.loadEmailSchedules();
    this.saving = false; this.showModal = false;
  }
}
