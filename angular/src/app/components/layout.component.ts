import { Component, Input, Output, EventEmitter, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ThemeService } from '../services/theme.service';
import { I18nService, Lang } from '../services/i18n.service';
import { CompanyService, Company } from '../services/company.service';
import { PermissionsService } from '../services/permissions.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
<div class="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
  <!-- Sidebar -->
  <aside [class]="'flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ' + (sidebarOpen ? 'w-64' : 'w-16')">
    <!-- Logo -->
    <div class="flex items-center h-16 px-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
      <div class="flex items-center gap-3 overflow-hidden">
        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
          <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        </div>
        <span *ngIf="sidebarOpen" class="font-bold text-gray-900 dark:text-white text-lg whitespace-nowrap">FacturaPro</span>
      </div>
    </div>

    <!-- Company switcher -->
    <div *ngIf="sidebarOpen && companies.length > 1" class="px-3 py-2 border-b border-gray-200 dark:border-gray-800">
      <select (change)="onCompanyChange($event)" [value]="currentCompany?.id ?? ''"
        class="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none">
        <option *ngFor="let c of companies" [value]="c.id">{{c.name}}</option>
      </select>
    </div>

    <!-- Nav -->
    <nav class="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
      <ng-container *ngFor="let item of navItems">
        <button *ngIf="perms.canView(item.key)" (click)="navigate(item.key)"
          [class]="'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ' + (activePage === item.key ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white')">
          <span class="shrink-0" [innerHTML]="item.icon"></span>
          <span *ngIf="sidebarOpen" class="truncate whitespace-nowrap">{{i18n.t(item.key)}}</span>
        </button>
      </ng-container>
    </nav>

    <!-- Bottom controls -->
    <div class="border-t border-gray-200 dark:border-gray-800 p-2 space-y-0.5 shrink-0">
      <!-- Lang -->
      <div *ngIf="sidebarOpen" class="flex gap-1 px-1 pb-1">
        <button *ngFor="let l of langs" (click)="setLang(l.code)"
          [class]="'flex-1 text-xs py-1 rounded-lg font-medium transition-colors ' + (i18n.lang() === l.code ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800')">
          {{l.label}}
        </button>
      </div>
      <!-- Theme toggle -->
      <button (click)="themeService.toggle()" class="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <span *ngIf="themeService.isDark()" class="w-5 h-5 shrink-0">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
        </span>
        <span *ngIf="!themeService.isDark()" class="w-5 h-5 shrink-0">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
        </span>
        <span *ngIf="sidebarOpen">{{i18n.t(themeService.isDark() ? 'light' : 'dark')}}</span>
      </button>
      <!-- User -->
      <div *ngIf="sidebarOpen && auth.user() as user" class="flex items-center gap-2 px-3 py-2">
        <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center shrink-0">
          <span class="text-sm font-semibold text-blue-600 dark:text-blue-400">{{user.name.charAt(0).toUpperCase()}}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{user.name}}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 capitalize">{{user.role}}</p>
        </div>
      </div>
      <!-- Logout -->
      <button (click)="onLogout()" class="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
        <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
        <span *ngIf="sidebarOpen">{{i18n.t('logout')}}</span>
      </button>
    </div>
  </aside>

  <!-- Main content -->
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Top bar -->
    <header class="flex items-center h-16 px-4 md:px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shrink-0 gap-4">
      <button (click)="sidebarOpen = !sidebarOpen" class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
      <div class="flex-1">
        <h1 class="text-lg font-semibold text-gray-900 dark:text-white capitalize">{{i18n.t(activePage)}}</h1>
      </div>
      <div *ngIf="currentCompany" class="hidden md:block text-sm text-gray-500 dark:text-gray-400">{{currentCompany.name}}</div>
    </header>

    <!-- Page content -->
    <main class="flex-1 overflow-y-auto p-4 md:p-6">
      <ng-content></ng-content>
    </main>
  </div>
</div>
  `
})
export class LayoutComponent implements OnInit {
  @Input() activePage = 'dashboard';
  @Output() pageChange = new EventEmitter<string>();
  @Output() logoutEvent = new EventEmitter<void>();

  sidebarOpen = true;
  langs = [{ code: 'es' as Lang, label: 'ES' }, { code: 'en' as Lang, label: 'EN' }, { code: 'fr' as Lang, label: 'FR' }];

  navItems = [
    { key: 'dashboard', icon: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7h18M3 12h18M3 17h18"/></svg>' },
    { key: 'invoices', icon: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' },
    { key: 'clients', icon: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>' },
    { key: 'products', icon: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>' },
    { key: 'payments', icon: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>' },
    { key: 'electronic', icon: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>' },
    { key: 'email_schedules', icon: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>' },
    { key: 'notifications', icon: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>' },
    { key: 'analytics', icon: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
    { key: 'monthly_report', icon: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' },
    { key: 'swagger', icon: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>' },
    { key: 'admin', icon: '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>' },
  ];

  get companies(): Company[] { return this.companyService.companies(); }
  get currentCompany(): Company | null { return this.companyService.currentCompany(); }

  constructor(
    public auth: AuthService,
    public themeService: ThemeService,
    public i18n: I18nService,
    private companyService: CompanyService,
    public perms: PermissionsService,
  ) {}

  ngOnInit() {
    const u = this.auth.user();
    if (u) this.perms.load(u.id, u.role);
  }

  navigate(page: string) { this.pageChange.emit(page); }

  setLang(l: Lang) { this.i18n.setLang(l); }

  onCompanyChange(e: Event) {
    const id = (e.target as HTMLSelectElement).value;
    const c = this.companies.find(x => x.id === id);
    if (c) this.companyService.setCompany(c);
  }

  async onLogout() {
    await this.auth.logout();
    this.logoutEvent.emit();
  }
}
