import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../services/i18n.service';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="space-y-4">
  <div class="flex justify-between items-center">
    <p class="text-sm text-gray-500 dark:text-gray-400">{{unread}} sin leer</p>
    <button *ngIf="unread > 0" (click)="markAll()" class="text-sm text-blue-600 dark:text-blue-400 hover:underline">{{i18n.t('mark_all_read')}}</button>
  </div>
  <div class="space-y-2">
    <div *ngFor="let n of data.notifications()" [class]="'bg-white dark:bg-gray-900 rounded-2xl border p-4 transition-all ' + (n.is_read ? 'border-gray-200 dark:border-gray-800 opacity-70' : 'border-blue-200 dark:border-blue-800 shadow-sm')">
      <div class="flex items-start gap-3">
        <div [class]="'w-2 h-2 mt-2 rounded-full shrink-0 ' + (n.is_read ? 'bg-gray-300' : 'bg-blue-500')"></div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">{{n.title}}</p>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{{n.message}}</p>
          <p class="text-xs text-gray-400 mt-1">{{data.formatDate(n.created_at)}}</p>
        </div>
        <button *ngIf="!n.is_read" (click)="markOne(n.id)" class="text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0">{{i18n.t('mark_read')}}</button>
      </div>
    </div>
    <p *ngIf="!data.notifications().length" class="text-center py-12 text-gray-400">{{i18n.t('no_data')}}</p>
  </div>
</div>
  `
})
export class NotificationsComponent implements OnInit {
  constructor(public i18n: I18nService, public data: DataService) {}
  ngOnInit() { this.data.loadNotifications(); }
  get unread() { return this.data.notifications().filter(n => !n.is_read).length; }

  async markOne(id: string) {
    await this.data.db.from('notifications').update({ is_read: true }).eq('id', id);
    this.data.loadNotifications();
  }

  async markAll() {
    await this.data.db.from('notifications').update({ is_read: true }).eq('is_read', false);
    this.data.loadNotifications();
  }
}
