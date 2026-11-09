import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../services/i18n.service';
import { DataService } from '../../services/data.service';
import { PermissionsService, PAGE_LIST } from '../../services/permissions.service';
import { AuthService } from '../../services/auth.service';
import { CompanyService } from '../../services/company.service';
import { ModalComponent } from '../../components/modal.component';
import { DbService } from '../../services/db.service';
import { UserConfig } from '../../services/models';

type AdminTab = 'companies' | 'settings' | 'users' | 'permissions' | 'tax_rates' | 'email' | 'features' | 'region';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  template: `
<div class="space-y-4">
  <!-- Tabs -->
  <div class="flex gap-1 flex-wrap bg-white dark:bg-gray-900 p-1 rounded-2xl border border-gray-200 dark:border-gray-800">
    <button *ngFor="let tab of tabs" (click)="activeTab = tab.key"
      [class]="'px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ' + (activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800')">
      {{i18n.t(tab.key)}}
    </button>
  </div>

  <!-- Companies Tab -->
  <div *ngIf="activeTab === 'companies'" class="space-y-4">
    <div class="flex justify-between items-center">
      <h2 class="font-semibold text-gray-900 dark:text-white">{{i18n.t('companies')}}</h2>
      <button (click)="openCreateCompany()" class="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Nueva
      </button>
    </div>
    <div class="grid gap-3">
      <div *ngFor="let c of companyService.companies()" class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
        <div>
          <p class="font-medium text-gray-900 dark:text-white">{{c.name}}</p>
          <p class="text-xs text-gray-500">RNC: {{c.rnc}} · {{c.phone}}</p>
        </div>
        <button (click)="openEditCompany(c)" class="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
      </div>
    </div>
  </div>

  <!-- Users Tab -->
  <div *ngIf="activeTab === 'users'" class="space-y-4">
    <div class="flex justify-between items-center">
      <h2 class="font-semibold text-gray-900 dark:text-white">{{i18n.t('users')}}</h2>
      <div class="flex gap-2">
        <button (click)="resetSystem()" class="px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 text-red-600 text-sm rounded-xl">{{i18n.t('reset_system')}}</button>
        <button (click)="openCreateUser()" class="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          {{i18n.t('create_user')}}
        </button>
      </div>
    </div>
    <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-800/50">
          <tr>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{{i18n.t('name')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">{{i18n.t('email')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{{i18n.t('role')}}</th>
            <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{{i18n.t('status')}}</th>
            <th class="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr *ngFor="let u of data.usersConfig()" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <td class="px-6 py-4">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{u.name}}</p>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500 hidden md:table-cell">{{u.email}}</td>
            <td class="px-6 py-4">
              <span class="inline-flex px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-700 dark:text-gray-300">{{i18n.t(u.role)}}</span>
            </td>
            <td class="px-6 py-4">
              <span [class]="'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ' + (u.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500')">{{i18n.t(u.is_active ? 'active' : 'inactive')}}</span>
            </td>
            <td class="px-6 py-4">
              <div class="flex gap-2 justify-end">
                <button (click)="openEditUser(u)" class="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
              </div>
            </td>
          </tr>
          <tr *ngIf="!data.usersConfig().length"><td colspan="5" class="text-center py-8 text-gray-400">{{i18n.t('no_data')}}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Permissions Tab -->
  <div *ngIf="activeTab === 'permissions'" class="space-y-4">
    <h2 class="font-semibold text-gray-900 dark:text-white">{{i18n.t('permissions')}}</h2>
    <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Página / Rol</th>
              <ng-container *ngFor="let role of roles">
                <th class="text-center px-2 py-3 text-xs font-semibold text-gray-500 uppercase" colspan="4">{{i18n.t(role)}}</th>
              </ng-container>
            </tr>
            <tr class="border-t border-gray-200 dark:border-gray-700">
              <th class="px-4 py-2"></th>
              <ng-container *ngFor="let role of roles">
                <th class="text-center px-1 py-2 text-xs text-gray-400">V</th>
                <th class="text-center px-1 py-2 text-xs text-gray-400">C</th>
                <th class="text-center px-1 py-2 text-xs text-gray-400">E</th>
                <th class="text-center px-1 py-2 text-xs text-gray-400">D</th>
              </ng-container>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr *ngFor="let page of pages" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white capitalize">{{i18n.t(page)}}</td>
              <ng-container *ngFor="let role of roles">
                <td class="text-center px-1 py-3"><input type="checkbox" [checked]="getPerm(role, page, 'can_view')" (change)="setPerm(role, page, 'can_view', $event)" class="rounded border-gray-300 text-blue-600"></td>
                <td class="text-center px-1 py-3"><input type="checkbox" [checked]="getPerm(role, page, 'can_create')" (change)="setPerm(role, page, 'can_create', $event)" class="rounded border-gray-300 text-blue-600"></td>
                <td class="text-center px-1 py-3"><input type="checkbox" [checked]="getPerm(role, page, 'can_edit')" (change)="setPerm(role, page, 'can_edit', $event)" class="rounded border-gray-300 text-blue-600"></td>
                <td class="text-center px-1 py-3"><input type="checkbox" [checked]="getPerm(role, page, 'can_delete')" (change)="setPerm(role, page, 'can_delete', $event)" class="rounded border-gray-300 text-blue-600"></td>
              </ng-container>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Settings Tab -->
  <div *ngIf="activeTab === 'settings'" class="space-y-4">
    <h2 class="font-semibold text-gray-900 dark:text-white">{{i18n.t('settings')}}</h2>
    <div class="grid gap-3">
      <div *ngFor="let s of data.settings()" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center gap-4">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{s.key}}</p>
          <p class="text-xs text-gray-500">{{s.description}}</p>
        </div>
        <input [(ngModel)]="s.value" type="text" (blur)="saveSetting(s)" class="w-48 px-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
      </div>
    </div>
  </div>

  <!-- Tax Rates Tab -->
  <div *ngIf="activeTab === 'tax_rates'" class="space-y-4">
    <div class="flex justify-between items-center">
      <h2 class="font-semibold text-gray-900 dark:text-white">{{i18n.t('tax_rates')}}</h2>
      <button (click)="openCreateTax()" class="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl">+ Nueva</button>
    </div>
    <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 dark:bg-gray-800/50"><tr>
          <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{{i18n.t('name')}}</th>
          <th class="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{{i18n.t('tax_rate')}}</th>
          <th class="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{{i18n.t('status')}}</th>
        </tr></thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr *ngFor="let t of data.taxRates()" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <td class="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">{{t.name}}</td>
            <td class="px-6 py-3 text-right text-sm text-gray-600 dark:text-gray-400">{{t.rate}}%</td>
            <td class="px-6 py-3">
              <span [class]="'inline-flex px-2 py-0.5 rounded-full text-xs ' + (t.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500')">{{i18n.t(t.is_active ? 'active' : 'inactive')}}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Features Tab -->
  <div *ngIf="activeTab === 'features'" class="space-y-4">
    <h2 class="font-semibold text-gray-900 dark:text-white">{{i18n.t('feature_flags')}}</h2>
    <div class="grid gap-3">
      <div *ngFor="let f of data.featureFlags()" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{f.name}}</p>
          <p class="text-xs text-gray-500">{{f.description}}</p>
        </div>
        <button (click)="toggleFlag(f)" [class]="'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' + (f.is_enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600')">
          <span [class]="'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ' + (f.is_enabled ? 'translate-x-6' : 'translate-x-1')"></span>
        </button>
      </div>
    </div>
  </div>

  <!-- Region Tab -->
  <div *ngIf="activeTab === 'region'" class="space-y-4">
    <h2 class="font-semibold text-gray-900 dark:text-white">{{i18n.t('region')}}</h2>
    <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
      <div class="grid grid-cols-3 gap-3">
        <button *ngFor="let r of regions" (click)="i18n.setRegion(r.code)"
          [class]="'p-4 rounded-xl border-2 text-sm font-medium transition-all ' + (i18n.region() === r.code ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300')">
          {{r.label}}
        </button>
      </div>
      <div class="mt-4 text-sm text-gray-500 dark:text-gray-400">
        <p>{{i18n.t('currency')}}: {{i18n.regionConfig().currency}} ({{i18n.regionConfig().currencySymbol}})</p>
        <p>{{i18n.t('tax_rate')}}: {{(i18n.regionConfig().taxRate * 100).toFixed(0)}}% ({{i18n.regionConfig().taxLabel}})</p>
      </div>
    </div>
  </div>

  <!-- Email Tab -->
  <div *ngIf="activeTab === 'email'" class="space-y-4">
    <h2 class="font-semibold text-gray-900 dark:text-white">SMTP</h2>
    <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
      <div class="grid grid-cols-2 gap-4">
        <div *ngFor="let key of smtpKeys">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{key}}</label>
          <input [type]="key.includes('password') ? 'password' : 'text'" [value]="data.getSetting(key)" (blur)="saveSettingByKey(key, $event)" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Company Modal -->
<app-modal [isOpen]="showCompanyModal" [title]="editingCompany ? i18n.t('edit') + ' ' + i18n.t('company') : 'Nueva Empresa'" (close)="showCompanyModal = false">
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div class="col-span-2"><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('name')}} *</label><input [(ngModel)]="companyForm.name" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
      <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">RNC</label><input [(ngModel)]="companyForm.rnc" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
      <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('phone')}}</label><input [(ngModel)]="companyForm.phone" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
      <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('email')}}</label><input [(ngModel)]="companyForm.email" type="email" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
      <div class="col-span-2"><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('address')}}</label><input [(ngModel)]="companyForm.address" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
    </div>
    <div class="flex gap-3 justify-end pt-2">
      <button (click)="showCompanyModal = false" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">{{i18n.t('cancel')}}</button>
      <button (click)="saveCompany()" [disabled]="saving" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl">{{saving ? i18n.t('loading') : i18n.t('save')}}</button>
    </div>
  </div>
</app-modal>

<!-- User Modal -->
<app-modal [isOpen]="showUserModal" [title]="editingUser ? i18n.t('edit') : i18n.t('create_user')" (close)="showUserModal = false">
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div class="col-span-2"><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('name')}} *</label><input [(ngModel)]="userForm.name" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
      <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('email')}} *</label><input [(ngModel)]="userForm.email" type="email" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none"></div>
      <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('role')}}</label>
        <select [(ngModel)]="userForm.role" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
          <option *ngFor="let r of userRoles" [value]="r">{{i18n.t(r)}}</option>
        </select></div>
      <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('email_language')}}</label>
        <select [(ngModel)]="userForm.email_language" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none">
          <option value="es">Español</option><option value="en">English</option><option value="fr">Français</option>
        </select></div>
      <div class="flex items-center gap-2 col-span-2 mt-2"><input [(ngModel)]="userForm.is_active" type="checkbox" id="uActive" class="rounded"><label for="uActive" class="text-sm text-gray-700 dark:text-gray-300">{{i18n.t('active')}}</label></div>
    </div>
    <div *ngIf="formError" class="text-red-500 text-sm">{{formError}}</div>
    <div class="flex gap-3 justify-end pt-2">
      <button (click)="showUserModal = false" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">{{i18n.t('cancel')}}</button>
      <button (click)="saveUser()" [disabled]="saving" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-xl">{{saving ? i18n.t('loading') : i18n.t('save')}}</button>
    </div>
  </div>
</app-modal>

<!-- Temp password modal -->
<app-modal [isOpen]="showTempPassModal" [title]="i18n.t('temp_password')" (close)="showTempPassModal = false">
  <div class="text-center space-y-4">
    <p class="text-sm text-gray-600 dark:text-gray-400">Contraseña temporal generada para <strong>{{tempPassUser}}</strong>:</p>
    <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 font-mono text-xl font-bold text-gray-900 dark:text-white tracking-wider">{{tempPassValue}}</div>
    <button (click)="copyTempPass()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl">{{i18n.t('copy')}}</button>
  </div>
</app-modal>

<!-- Reset System Modal -->
<app-modal [isOpen]="showResetModal" [title]="i18n.t('reset_system')" (close)="showResetModal = false">
  <div class="space-y-4">
    <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4">
      <p class="text-sm font-semibold text-red-700 dark:text-red-400">ADVERTENCIA: Esta acción eliminará todos los datos.</p>
      <p class="text-xs text-red-600 dark:text-red-400 mt-1">Escribe RESTABLECER para confirmar.</p>
    </div>
    <input [(ngModel)]="resetConfirmText" type="text" placeholder="RESTABLECER" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm focus:outline-none">
    <div class="flex gap-3 justify-end">
      <button (click)="showResetModal = false" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">{{i18n.t('cancel')}}</button>
      <button (click)="confirmReset()" [disabled]="resetConfirmText !== 'RESTABLECER' || resetting" class="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-xl">{{resetting ? 'Restableciendo...' : 'Confirmar'}}</button>
    </div>
  </div>
</app-modal>

<!-- Tax rate modal -->
<app-modal [isOpen]="showTaxModal" [title]="'Nueva Tasa de Impuesto'" (close)="showTaxModal = false">
  <div class="space-y-4">
    <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('name')}}</label><input [(ngModel)]="taxForm.name" type="text" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm focus:outline-none"></div>
    <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{i18n.t('tax_rate')}} (%)</label><input [(ngModel)]="taxForm.rate" type="number" class="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl text-sm focus:outline-none"></div>
    <div class="flex gap-3 justify-end">
      <button (click)="showTaxModal = false" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">{{i18n.t('cancel')}}</button>
      <button (click)="saveTax()" [disabled]="saving" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl">{{i18n.t('save')}}</button>
    </div>
  </div>
</app-modal>
  `
})
export class AdminComponent implements OnInit {
  activeTab: AdminTab = 'companies';
  tabs: { key: AdminTab }[] = [
    { key: 'companies' }, { key: 'settings' }, { key: 'users' }, { key: 'permissions' },
    { key: 'tax_rates' }, { key: 'email' }, { key: 'features' }, { key: 'region' },
  ];
  roles = ['manager','assistant','operator','viewer'];
  userRoles = ['admin','manager','assistant','operator','viewer'];
  pages = PAGE_LIST;
  smtpKeys = ['smtp_host','smtp_port','smtp_user','smtp_password','smtp_from','smtp_name'];
  regions = [{ code: 'DO' as const, label: 'Rep. Dominicana (DO)' }, { code: 'US' as const, label: 'United States (US)' }, { code: 'CA' as const, label: 'Canada (CA)' }];

  showCompanyModal = false;
  showUserModal = false;
  showTempPassModal = false;
  showResetModal = false;
  showTaxModal = false;
  editingCompany: unknown = null;
  editingUser: UserConfig | null = null;
  saving = false;
  resetting = false;
  formError = '';
  resetConfirmText = '';
  tempPassValue = '';
  tempPassUser = '';

  companyForm = { name: '', rnc: '', phone: '', email: '', address: '', country: 'DO' };
  userForm = { name: '', email: '', role: 'operator', is_active: true, email_language: 'es' };
  taxForm = { name: '', rate: 18, description: '', is_active: true };

  constructor(
    public i18n: I18nService, public data: DataService, public perms: PermissionsService,
    public auth: AuthService, public companyService: CompanyService, private db: DbService,
  ) {}

  ngOnInit() {
    const u = this.auth.user();
    if (u) this.perms.load(u.id, u.role);
    this.data.loadAll(this.companyService.currentCompany()?.id);
  }

  openCreateCompany() { this.editingCompany = null; this.companyForm = { name: '', rnc: '', phone: '', email: '', address: '', country: 'DO' }; this.showCompanyModal = true; }
  openEditCompany(c: unknown) { const co = c as Record<string, string>; this.editingCompany = c; this.companyForm = { name: co['name'], rnc: co['rnc'], phone: co['phone'], email: co['email'], address: co['address'], country: co['country'] ?? 'DO' }; this.showCompanyModal = true; }

  async saveCompany() {
    this.saving = true;
    if (this.editingCompany) {
      await this.db.client.from('companies').update({ ...this.companyForm, updated_at: new Date().toISOString() }).eq('id', (this.editingCompany as Record<string, string>)['id']);
    } else {
      await this.db.client.from('companies').insert({ ...this.companyForm, is_active: true });
    }
    await this.companyService.loadCompanies();
    this.saving = false; this.showCompanyModal = false;
  }

  openCreateUser() { this.editingUser = null; this.userForm = { name: '', email: '', role: 'operator', is_active: true, email_language: 'es' }; this.formError = ''; this.showUserModal = true; }
  openEditUser(u: UserConfig) { this.editingUser = u; this.userForm = { name: u.name, email: u.email, role: u.role, is_active: u.is_active, email_language: ((u as unknown) as Record<string, string>)['email_language'] ?? 'es' }; this.formError = ''; this.showUserModal = true; }

  async saveUser() {
    if (!this.userForm.name || !this.userForm.email) { this.formError = 'Nombre y correo son requeridos'; return; }
    this.saving = true; this.formError = '';
    if (this.editingUser) {
      await this.db.client.from('users_config').update({ ...this.userForm, updated_at: new Date().toISOString() }).eq('id', this.editingUser.id);
    } else {
      const tempPass = this.auth.generateTempPassword();
      // The API hashes temp_password with bcrypt before storing it.
      await this.db.client.from('users_config').insert({ ...this.userForm, must_change_password: true, temp_password: tempPass, failed_login_attempts: 0 });
      await this.auth.sendWelcomeEmail(this.userForm.email, this.userForm.name, tempPass, this.userForm.email_language);
      this.tempPassValue = tempPass; this.tempPassUser = this.userForm.name; this.showTempPassModal = true;
    }
    await this.data.loadUsersConfig();
    this.saving = false; this.showUserModal = false;
  }

  copyTempPass() { navigator.clipboard.writeText(this.tempPassValue).catch(() => {}); }

  async saveSetting(s: { id: string; key: string; value: string }) {
    await this.db.client.from('settings').update({ value: s.value, updated_at: new Date().toISOString() }).eq('id', s.id);
  }

  async saveSettingByKey(key: string, e: Event) {
    const val = (e.target as HTMLInputElement).value;
    await this.db.client.from('settings').update({ value: val, updated_at: new Date().toISOString() }).eq('key', key);
  }

  getPerm(role: string, page: string, field: string): boolean {
    const rp = this.perms.rolePermissions().find(p => p.role === role && p.page === page);
    return rp ? (rp as unknown as Record<string, boolean>)[field] : false;
  }

  async setPerm(role: string, page: string, field: string, e: Event) {
    const val = (e.target as HTMLInputElement).checked;
    await this.perms.updatePermission(role, page, field, val);
  }

  async toggleFlag(f: { id: string; name: string; is_enabled: boolean }) {
    await this.db.client.from('feature_flags').update({ is_enabled: !f.is_enabled, updated_at: new Date().toISOString() }).eq('id', f.id);
    await this.data.loadFeatureFlags();
  }

  resetSystem() { this.resetConfirmText = ''; this.showResetModal = true; }

  async confirmReset() {
    if (this.resetConfirmText !== 'RESTABLECER') return;
    this.resetting = true;
    const db = this.db.client;
    await Promise.all([
      db.from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      db.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      db.from('products_services').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      db.from('payment_records').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      db.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      db.from('email_log').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    ]);
    // The API hashes the supplied "password" value with bcrypt.
    await db.from('users_config').update({ password: 'admin', must_change_password: false, failed_login_attempts: 0, locked_until: null }).eq('role', 'admin');
    this.resetting = false; this.showResetModal = false;
    await this.data.loadAll(this.companyService.currentCompany()?.id);
  }

  openCreateTax() { this.taxForm = { name: '', rate: 18, description: '', is_active: true }; this.showTaxModal = true; }

  async saveTax() {
    this.saving = true;
    await this.db.client.from('tax_rates').insert(this.taxForm);
    await this.data.loadTaxRates();
    this.saving = false; this.showTaxModal = false;
  }
}
