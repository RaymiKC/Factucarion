import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../services/i18n.service';
import { SupabaseService, EcfProviderConfig } from '../../services/supabase.service';

@Component({
  selector: 'app-electronic',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="space-y-6">
  <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Facturación Electrónica (e-CF)</h2>
    <div *ngIf="!config"><p class="text-gray-500">{{i18n.t('loading')}}</p></div>
    <div *ngIf="config" class="space-y-6">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{i18n.t('provider')}}</label>
        <div class="flex gap-3">
          <button (click)="config.mode = 'third_party'" [class]="'px-4 py-2 rounded-xl text-sm font-medium transition-colors ' + (config.mode === 'third_party' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300')">Proveedor Externo</button>
          <button (click)="config.mode = 'own_service'" [class]="'px-4 py-2 rounded-xl text-sm font-medium transition-colors ' + (config.mode === 'own_service' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300')">Servicio Propio</button>
        </div>
      </div>
      <div *ngIf="config.mode === 'third_party'" class="grid grid-cols-2 gap-4">
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('provider')}}</label><input [(ngModel)]="config.third_party_provider" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label><input [(ngModel)]="config.third_party_api_key" type="password" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
      </div>
      <div *ngIf="config.mode === 'own_service'" class="grid grid-cols-2 gap-4">
        <div class="col-span-2"><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL</label><input [(ngModel)]="config.own_service_url" type="url" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Token</label><input [(ngModel)]="config.own_service_token" type="password" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
        <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ambiente</label>
          <select [(ngModel)]="config.own_service_environment" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
            <option value="sandbox">{{i18n.t('sandbox')}}</option><option value="production">{{i18n.t('production')}}</option>
          </select></div>
      </div>
      <div class="flex flex-col gap-3 pt-2">
        <label class="flex items-center gap-3 cursor-pointer"><input [(ngModel)]="config.auto_submit" type="checkbox" class="w-4 h-4 rounded"><span class="text-sm text-gray-700 dark:text-gray-300">{{i18n.t('auto_submit')}}</span></label>
        <label class="flex items-center gap-3 cursor-pointer"><input [(ngModel)]="config.retry_on_failure" type="checkbox" class="w-4 h-4 rounded"><span class="text-sm text-gray-700 dark:text-gray-300">{{i18n.t('retry')}}</span></label>
      </div>
      <div class="flex gap-3 pt-2">
        <button (click)="save()" [disabled]="saving" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl">{{saving ? i18n.t('loading') : i18n.t('save')}}</button>
        <button (click)="test()" [disabled]="testing" class="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl">{{testing ? 'Probando...' : i18n.t('test_connection')}}</button>
      </div>
      <div *ngIf="message" [class]="'text-sm px-4 py-2 rounded-xl ' + (messageOk ? 'bg-green-50 dark:bg-green-900/20 text-green-700' : 'bg-red-50 dark:bg-red-900/20 text-red-600')">{{message}}</div>
    </div>
  </div>
</div>
  `
})
export class ElectronicComponent implements OnInit {
  config: EcfProviderConfig | null = null;
  saving = false; testing = false; message = ''; messageOk = false;

  constructor(public i18n: I18nService, private supabase: SupabaseService) {}

  async ngOnInit() {
    const { data } = await this.supabase.client.from('ecf_provider_config').select('*').maybeSingle();
    this.config = data;
    if (!this.config) {
      this.config = { id: '', mode: 'third_party', own_service_url: '', own_service_token: '', own_service_environment: 'sandbox', third_party_provider: '', third_party_api_key: '', webhook_url: '', webhook_secret: '', auto_submit: false, retry_on_failure: false, updated_at: '' } as unknown as EcfProviderConfig;
    }
  }

  async save() {
    if (!this.config) return;
    this.saving = true;
    if (this.config.id) {
      await this.supabase.client.from('ecf_provider_config').update({ ...this.config, updated_at: new Date().toISOString() }).eq('id', this.config.id);
    } else {
      const { data } = await this.supabase.client.from('ecf_provider_config').insert({ ...this.config, updated_at: new Date().toISOString() }).select().single();
      if (data) this.config = data;
    }
    this.saving = false; this.message = 'Guardado correctamente'; this.messageOk = true;
  }

  async test() {
    this.testing = true; this.message = '';
    await new Promise(r => setTimeout(r, 800));
    this.testing = false; this.message = 'Conexión exitosa (simulada)'; this.messageOk = true;
  }
}
