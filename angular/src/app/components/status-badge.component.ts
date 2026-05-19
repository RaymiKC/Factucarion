import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {{colorClass}}">{{label}}</span>`
})
export class StatusBadgeComponent {
  @Input() status = '';
  @Input() label = '';

  get colorClass(): string {
    const map: Record<string, string> = {
      paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      partial: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      sent: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
      void: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      inactive: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    };
    return map[this.status] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
}
