import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="isOpen" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" (click)="close.emit()"></div>
      <div class="relative bg-white dark:bg-gray-800 shadow-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl overflow-y-auto safe-bottom">
        <div class="pt-2 pb-1 sm:hidden flex justify-center">
          <div class="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></div>
        </div>
        <div class="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white pr-2">{{title}}</h2>
          <button (click)="close.emit()" class="p-2 -mr-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="p-4 sm:p-6"><ng-content></ng-content></div>
      </div>
    </div>
  `
})
export class ModalComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Output() close = new EventEmitter<void>();
}
