import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../services/data.service';
import { I18nService } from '../services/i18n.service';
import { CompanyService } from '../services/company.service';
import { Client, Invoice, InvoiceItem } from '../services/models';

type Theme = 'classic' | 'modern' | 'minimal' | 'bold';

interface ThemeConfig {
  headerBg: string;
  headerText: string;
  accentBg: string;
  accentText: string;
  borderColor: string;
  tableHead: string;
  tableHeadText: string;
  totalRow: string;
  totalRowText: string;
}

const THEMES: Record<Theme, ThemeConfig> = {
  classic: {
    headerBg:      'bg-slate-900',
    headerText:    'text-white',
    accentBg:      'bg-slate-900',
    accentText:    'text-white',
    borderColor:   'border-slate-900',
    tableHead:     'bg-slate-900',
    tableHeadText: 'text-white',
    totalRow:      'bg-slate-900',
    totalRowText:  'text-white',
  },
  modern: {
    headerBg:      'bg-sky-600',
    headerText:    'text-white',
    accentBg:      'bg-sky-600',
    accentText:    'text-white',
    borderColor:   'border-sky-600',
    tableHead:     'bg-sky-600',
    tableHeadText: 'text-white',
    totalRow:      'bg-sky-600',
    totalRowText:  'text-white',
  },
  minimal: {
    headerBg:      'bg-white',
    headerText:    'text-slate-900',
    accentBg:      'bg-slate-100',
    accentText:    'text-slate-800',
    borderColor:   'border-slate-300',
    tableHead:     'bg-slate-100',
    tableHeadText: 'text-slate-700',
    totalRow:      'bg-slate-100',
    totalRowText:  'text-slate-900',
  },
  bold: {
    headerBg:      'bg-rose-600',
    headerText:    'text-white',
    accentBg:      'bg-rose-600',
    accentText:    'text-white',
    borderColor:   'border-rose-600',
    tableHead:     'bg-rose-600',
    tableHeadText: 'text-white',
    totalRow:      'bg-rose-600',
    totalRowText:  'text-white',
  },
};

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; font-family: Arial, Helvetica, sans-serif; }
  .invoice-paper { max-width: 780px; margin: 0 auto; box-shadow: none !important; border-radius: 0 !important; }
  table { border-collapse: collapse; }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    @page { margin: 10mm; size: A4; }
  }
`;

@Component({
  selector: 'app-invoice-template',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8 px-4">
  <!-- Action bar (never printed) -->
  <div class="fixed top-4 right-4 flex items-center gap-2 z-10">
    <button (click)="print()"
      class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl shadow transition-colors">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 14h12v8H6z"/>
      </svg>
      {{i18n.t('print_btn')}}
    </button>
    <button (click)="close.emit()" [attr.aria-label]="i18n.t('print_close')"
      class="p-2 bg-white rounded-lg shadow hover:bg-gray-50 text-gray-600">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  </div>

  <!-- Invoice paper -->
  <div #paper class="bg-white w-full max-w-3xl shadow-2xl rounded-lg overflow-hidden invoice-paper">
    <div *ngIf="theme !== 'minimal'" class="h-2 w-full" [ngClass]="tc.accentBg"></div>

    <!-- Header -->
    <div class="flex items-start justify-between px-10 pt-8 pb-6"
      [ngClass]="theme === 'minimal' ? 'border-b-2 border-slate-300' : 'border-b-4 ' + tc.borderColor">

      <div class="flex-1">
        <img *ngIf="companyLogoUrl; else initials" [src]="companyLogoUrl" [alt]="companyName"
          class="h-14 max-w-[160px] object-contain mb-3">
        <ng-template #initials>
          <div class="w-14 h-14 rounded-xl flex items-center justify-center mb-3" [ngClass]="tc.accentBg">
            <span class="font-black text-lg tracking-wider" [ngClass]="tc.accentText">{{companyInitials}}</span>
          </div>
        </ng-template>

        <h2 class="text-base font-bold text-slate-900 leading-tight">{{companyName}}</h2>
        <div class="text-xs text-slate-600 mt-1 space-y-0.5 leading-relaxed">
          <div *ngFor="let line of companyAddressLines">{{line}}</div>
          <div>RNC: {{companyRnc}}</div>
          <div *ngIf="companyPhone">Tel: {{companyPhone}}</div>
          <div *ngIf="companyEmail">{{companyEmail}}</div>
        </div>
      </div>

      <div class="ml-6 border-2 rounded-lg overflow-hidden min-w-[200px]" [ngClass]="tc.borderColor">
        <div class="px-4 py-2" [ngClass]="tc.accentBg">
          <p class="text-center font-bold text-sm" [ngClass]="tc.accentText">{{i18n.t('print_invoice')}}</p>
        </div>
        <div class="p-4 space-y-1 text-xs">
          <div class="flex justify-between gap-4">
            <span class="font-semibold text-slate-600">{{i18n.t('print_no')}}</span>
            <span class="font-bold text-slate-900">{{invoice.invoice_number}}</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="font-semibold text-slate-600">{{i18n.t('print_ncf')}}</span>
            <span class="font-bold text-slate-900">{{invoice.ncf || invoice.invoice_number}}</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="font-semibold text-slate-600">{{i18n.t('print_date')}}</span>
            <span class="font-bold text-slate-900">{{data.formatDate(invoice.issue_date)}}</span>
          </div>
          <div *ngIf="invoice.due_date" class="flex justify-between gap-4">
            <span class="font-semibold text-slate-600">{{i18n.t('print_due')}}</span>
            <span class="font-bold text-slate-900">{{data.formatDate(invoice.due_date)}}</span>
          </div>
          <div *ngIf="dgiiAuth" class="pt-2 border-t border-slate-200">
            <div class="text-slate-600 font-semibold">{{i18n.t('print_dgii_auth')}}</div>
            <div class="font-bold text-slate-900">{{dgiiAuth}}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Client -->
    <div class="px-10 py-5 border-b border-slate-200 bg-slate-50">
      <div class="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
        <div>
          <span class="font-bold text-slate-700">{{i18n.t('print_client')}} </span>
          <span class="font-bold text-slate-900">{{client?.name || '-'}}</span>
        </div>
        <div>
          <span class="font-bold text-slate-700">{{i18n.t('print_tax_id')}} </span>
          <span class="font-bold text-slate-900">{{client?.rnc || client?.cedula || '000000000'}}</span>
        </div>
        <div *ngIf="client?.address" class="col-span-2">
          <span class="font-bold text-slate-700">{{i18n.t('print_address')}} </span>
          <span class="text-slate-800">{{client?.address}}{{client?.city ? ', ' + client?.city : ''}}</span>
        </div>
        <div *ngIf="client?.email">
          <span class="font-bold text-slate-700">{{i18n.t('print_email')}} </span>
          <span class="text-slate-800">{{client?.email}}</span>
        </div>
        <div *ngIf="client?.phone">
          <span class="font-bold text-slate-700">Tel: </span>
          <span class="text-slate-800">{{client?.phone}}</span>
        </div>
      </div>
    </div>

    <!-- Line items -->
    <div class="px-10 py-4">
      <table class="w-full border-collapse text-xs">
        <thead>
          <tr [ngClass]="tc.tableHead">
            <th class="text-left px-3 py-2.5 font-semibold rounded-tl" [ngClass]="tc.tableHeadText">{{i18n.t('print_description')}}</th>
            <th class="text-center px-3 py-2.5 font-semibold w-16" [ngClass]="tc.tableHeadText">{{i18n.t('print_qty')}}</th>
            <th class="text-right px-3 py-2.5 font-semibold w-24" [ngClass]="tc.tableHeadText">{{i18n.t('print_unit_price')}}</th>
            <th class="text-right px-3 py-2.5 font-semibold w-24 rounded-tr" [ngClass]="tc.tableHeadText">{{i18n.t('print_total')}}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of paddedItems; let i = index" [ngClass]="i % 2 === 0 ? 'bg-white' : 'bg-slate-50'">
            <td class="px-3 py-2 border-b border-slate-100">{{item?.description ?? ''}}</td>
            <td class="px-3 py-2 border-b border-slate-100 text-center">{{item ? item.quantity : ''}}</td>
            <td class="px-3 py-2 border-b border-slate-100 text-right">{{item ? formatMoney(item.unit_price) : ''}}</td>
            <td class="px-3 py-2 border-b border-slate-100 text-right font-medium">{{item ? formatMoney(item.line_total) : ''}}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div class="px-10 pb-6 flex justify-end">
      <table class="text-xs border-collapse" [style.minWidth.px]="240">
        <tbody>
          <tr [ngClass]="tc.tableHead">
            <td class="px-4 py-2 font-bold uppercase" [ngClass]="tc.tableHeadText">{{i18n.t('print_amount_in')}} {{currency}}</td>
            <td class="px-4 py-2 font-bold text-right" [ngClass]="tc.tableHeadText">{{formatMoney(invoice.subtotal)}}</td>
          </tr>
          <tr class="border border-slate-300">
            <td class="px-4 py-1.5 font-semibold text-slate-600">{{i18n.t('print_subtotal')}}</td>
            <td class="px-4 py-1.5 text-right text-slate-800">{{formatMoney(invoice.subtotal)}}</td>
          </tr>
          <tr class="border border-slate-300 bg-slate-50">
            <td class="px-4 py-1.5 font-semibold text-slate-600">{{i18n.regionConfig().taxLabel}} {{taxRate}}%</td>
            <td class="px-4 py-1.5 text-right text-slate-800">{{taxRate > 0 ? formatMoney(invoice.tax_amount) : '0.00'}}</td>
          </tr>
          <tr *ngIf="invoice.discount_amount > 0" class="border border-slate-300">
            <td class="px-4 py-1.5 font-semibold text-slate-600">{{i18n.t('print_discount')}}</td>
            <td class="px-4 py-1.5 text-right text-slate-800">-{{formatMoney(invoice.discount_amount)}}</td>
          </tr>
          <tr [ngClass]="tc.totalRow">
            <td class="px-4 py-2.5 font-black text-sm" [ngClass]="tc.totalRowText">{{i18n.t('print_total')}}</td>
            <td class="px-4 py-2.5 font-black text-sm text-right" [ngClass]="tc.totalRowText">{{formatMoney(invoice.total)}}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Banking details -->
    <div *ngIf="bankName || bankAccount || bankIban"
      class="mx-10 mb-6 p-4 border-t-2 text-xs text-slate-700 leading-relaxed" [ngClass]="tc.borderColor">
      <p *ngIf="bankName">{{i18n.t('print_bank_checks')}} <strong>{{bankName}}</strong></p>
      <p *ngIf="bankAccount">{{i18n.t('print_bank_transfer')}} <strong>{{bankBankName || 'Banco'}}</strong>,
        {{i18n.t('print_bank_account')}} / <strong>{{bankAccount}}</strong></p>
      <p *ngIf="bankIban">{{i18n.t('print_bank_regional')}} / <strong>{{bankIban}}</strong></p>
      <p *ngIf="bankContact || bankContactTel || bankContactEmail" class="mt-2">
        {{i18n.t('print_bank_questions')}}
        <strong *ngIf="bankContact">{{bankContact}}</strong>
        <span *ngIf="bankContactTel"> Tel: <strong>{{bankContactTel}}</strong></span>
        <span *ngIf="bankContactEmail"> / E-mail: <strong class="text-sky-700">{{bankContactEmail}}</strong></span>
      </p>
    </div>

    <!-- Notes -->
    <div *ngIf="invoice.notes" class="mx-10 mb-6 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed">
      {{invoice.notes}}
    </div>

    <!-- Footer -->
    <div class="px-10 pb-8 flex items-center justify-between border-t-2 pt-4" [ngClass]="tc.borderColor">
      <div class="text-xs text-slate-400">
        <p>{{companyName}}</p>
        <p *ngIf="companyPhone">Tel: {{companyPhone}}</p>
        <p *ngIf="companyEmail">{{companyEmail}}</p>
      </div>
      <div class="text-xs text-slate-400 text-right">
        <p>{{i18n.t('print_invoice')}} #{{invoice.invoice_number}}</p>
        <p>{{i18n.t('print_date')}} {{data.formatDate(invoice.issue_date)}}</p>
        <p *ngIf="invoice.due_date">{{i18n.t('print_due')}} {{data.formatDate(invoice.due_date)}}</p>
      </div>
    </div>

    <div *ngIf="theme !== 'minimal'" class="h-2 w-full" [ngClass]="tc.accentBg"></div>
  </div>
</div>
  `
})
export class InvoiceTemplateComponent implements OnInit {
  @Input({ required: true }) invoice!: Invoice;
  @Input() items?: InvoiceItem[];
  @Output() close = new EventEmitter<void>();

  @ViewChild('paper', { static: true }) paper!: ElementRef<HTMLDivElement>;

  rowItems: InvoiceItem[] = [];
  theme: Theme = 'classic';
  tc: ThemeConfig = THEMES.classic;

  constructor(public i18n: I18nService, public data: DataService, private company: CompanyService) {}

  async ngOnInit() {
    if (!this.data.settings().length) {
      await this.data.loadSettings(this.company.currentCompany()?.id);
    }

    const stored = this.data.getSetting('invoice_theme') as Theme;
    this.theme = THEMES[stored] ? stored : 'classic';
    this.tc = THEMES[this.theme];

    if (this.items) {
      this.rowItems = [...this.items].sort((a, b) => a.sort_order - b.sort_order);
      return;
    }

    const { data } = await this.data.db
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', this.invoice.id)
      .order('sort_order');
    this.rowItems = (data ?? []) as InvoiceItem[];
  }

  get client(): Client | undefined { return this.invoice.client; }
  get currency(): string { return this.invoice.currency || 'DOP'; }
  get taxRate(): number { return this.rowItems.length ? Number(this.rowItems[0].tax_rate) : 0; }

  get paddedItems(): (InvoiceItem | null)[] {
    const rows: (InvoiceItem | null)[] = [...this.rowItems];
    while (rows.length < 8) rows.push(null);
    return rows;
  }

  get companyName(): string { return this.data.getSetting('company_name') || 'Mi Empresa S.R.L.'; }
  get companyRnc(): string { return this.data.getSetting('company_rnc') || '000000000'; }
  get companyPhone(): string { return this.data.getSetting('company_phone') || '809-000-0000'; }
  get companyEmail(): string { return this.data.getSetting('company_email') || ''; }
  get companyLogoUrl(): string { return this.data.getSetting('company_logo_url') || ''; }

  get companyAddressLines(): string[] {
    const address = this.data.getSetting('company_address') || 'Santo Domingo, República Dominicana';
    return address.split(',').map(line => line.trim()).filter(line => !!line);
  }

  get companyInitials(): string {
    return this.companyName.split(' ').map(word => word[0]).join('').slice(0, 3).toUpperCase();
  }

  get dgiiAuth(): string { return this.data.getSetting('dgii_auth_number') || ''; }
  get bankName(): string { return this.data.getSetting('bank_name') || ''; }
  get bankBankName(): string { return this.data.getSetting('bank_bank_name') || ''; }
  get bankAccount(): string { return this.data.getSetting('bank_account') || ''; }
  get bankIban(): string { return this.data.getSetting('bank_iban') || ''; }
  get bankContact(): string { return this.data.getSetting('bank_contact') || ''; }
  get bankContactTel(): string { return this.data.getSetting('bank_contact_tel') || ''; }
  get bankContactEmail(): string { return this.data.getSetting('bank_contact_email') || ''; }

  formatMoney(amount: number): string {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount ?? 0);
  }

  print(): void {
    const paper = this.paper?.nativeElement;
    if (!paper) return;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(node => node.outerHTML)
      .join('\n');

    win.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/>` +
      `<title>${this.escapeHtml(this.i18n.t('print_invoice'))} ${this.escapeHtml(this.invoice.invoice_number)}</title>` +
      `${styles}<style>${PRINT_STYLES}</style></head><body>${paper.outerHTML}</body></html>`
    );
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
