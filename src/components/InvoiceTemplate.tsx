import { useEffect, useState, useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSettings } from '../lib/hooks';
import type { Invoice, Client, InvoiceItem } from '../lib/supabase';
import { useI18n } from '../lib/i18n';

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
    accentBg:      'bg-slate-800',
    accentText:    'text-white',
    borderColor:   'border-slate-800',
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

interface InvoiceTemplateProps {
  invoice: Invoice;
  onClose: () => void;
}

export default function InvoiceTemplate({ invoice, onClose }: InvoiceTemplateProps) {
  const { t, formatDate, regionConfig } = useI18n();
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const { getSetting } = useSettings();
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id).order('sort_order')
      .then(({ data }) => setItems(data ?? []));
  }, [invoice.id]);

  const client = invoice.client as Client | undefined;

  const companyName      = getSetting('company_name')      || 'Mi Empresa S.R.L.';
  const companyRnc       = getSetting('company_rnc')       || '000000000';
  const companyAddress   = getSetting('company_address')   || 'Santo Domingo, República Dominicana';
  const companyPhone     = getSetting('company_phone')     || '809-000-0000';
  const companyEmail     = getSetting('company_email')     || '';
  const companyLogoUrl   = getSetting('company_logo_url')  || '';
  const bankName         = getSetting('bank_name')         || '';
  const bankAccount      = getSetting('bank_account')      || '';
  const bankIban         = getSetting('bank_iban')         || '';
  const bankContact      = getSetting('bank_contact')      || '';
  const bankContactTel   = getSetting('bank_contact_tel')  || '';
  const bankContactEmail = getSetting('bank_contact_email')|| '';
  const dgiiAuth         = getSetting('dgii_auth_number')  || '';
  const currency         = invoice.currency || 'DOP';
  const theme            = (getSetting('invoice_theme') || 'classic') as Theme;
  const tc               = THEMES[theme] ?? THEMES.classic;

  function formatMoney(n: number) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }

  function handlePrint() {
    const el = printRef.current;
    if (!el) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>${t('print_invoice')} ${invoice.invoice_number}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }
        ${getPrintStyles()}
      </style>
      </head><body>${el.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  }

  const MIN_ROWS = 8;
  const paddedItems: (InvoiceItem | null)[] = [...items];
  while (paddedItems.length < MIN_ROWS) paddedItems.push(null);

  const itbisRate = items.length > 0 ? items[0].tax_rate : 0;

  // Header border class depends on theme
  const headerBorderClass = theme === 'minimal' ? 'border-b-2 border-slate-300' : `border-b-4 ${tc.borderColor}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8 px-4">
      {/* Action bar */}
      <div className="fixed top-4 right-4 flex items-center gap-2 z-10">
        <button onClick={handlePrint}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow transition-colors">
          <Printer size={15} /> {t('print_btn')}
        </button>
        <button onClick={onClose}
          className="p-2 bg-white rounded-lg shadow hover:bg-slate-50 text-slate-600">
          <X size={18} />
        </button>
      </div>

      {/* Invoice paper */}
      <div ref={printRef} className="bg-white w-full max-w-3xl shadow-2xl rounded-lg overflow-hidden invoice-paper">

        {/* === THEME ACCENT BAR (modern / bold / classic) === */}
        {theme !== 'minimal' && (
          <div className={`h-2 w-full ${tc.accentBg}`} />
        )}

        {/* === HEADER === */}
        <div className={`flex items-start justify-between px-10 pt-8 pb-6 ${headerBorderClass}`}>
          {/* Company block */}
          <div className="flex-1">
            {companyLogoUrl ? (
              <img src={companyLogoUrl} alt={companyName} className="h-14 max-w-[160px] object-contain mb-3" />
            ) : (
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-3 ${tc.accentBg}`}>
                <span className={`font-black text-lg tracking-wider ${tc.accentText}`}>
                  {companyName.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()}
                </span>
              </div>
            )}
            <h2 className="text-base font-bold text-slate-900 leading-tight">{companyName}</h2>
            <div className="text-xs text-slate-600 mt-1 space-y-0.5 leading-relaxed">
              {companyAddress.split(',').map((line, i) => <div key={i}>{line.trim()}</div>)}
              <div>RNC: {companyRnc}</div>
              {companyPhone && <div>Tel: {companyPhone}</div>}
              {companyEmail && <div>{companyEmail}</div>}
            </div>
          </div>

          {/* Invoice metadata box */}
          <div className={`ml-6 border-2 ${tc.borderColor} rounded-lg overflow-hidden min-w-[200px]`}>
            <div className={`px-4 py-2 ${tc.accentBg}`}>
              <p className={`text-center font-bold text-sm ${tc.accentText}`}>{t('print_invoice')}</p>
            </div>
            <div className="p-4 space-y-1 text-xs">
              <div className="flex justify-between gap-4">
                <span className="font-semibold text-slate-600">{t('print_no')}</span>
                <span className="font-bold text-slate-900">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-semibold text-slate-600">{t('print_ncf')}</span>
                <span className="font-bold text-slate-900">{invoice.ncf || invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-semibold text-slate-600">{t('print_date')}</span>
                <span className="font-bold text-slate-900">{formatDate(invoice.issue_date)}</span>
              </div>
              {invoice.due_date && (
                <div className="flex justify-between gap-4">
                  <span className="font-semibold text-slate-600">Vence</span>
                  <span className="font-bold text-slate-900">{formatDate(invoice.due_date)}</span>
                </div>
              )}
              {dgiiAuth && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-slate-600 font-semibold">{t('print_dgii_auth')}</div>
                  <div className="font-bold text-slate-900">{dgiiAuth}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* === CLIENT INFO === */}
        <div className="px-10 py-5 border-b border-slate-200 bg-slate-50">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
            <div>
              <span className="font-bold text-slate-700">{t('print_client')} </span>
              <span className="font-bold text-slate-900">{client?.name ?? '-'}</span>
            </div>
            <div>
              <span className="font-bold text-slate-700">{t('print_tax_id')} </span>
              <span className="font-bold text-slate-900">{client?.rnc || client?.cedula || '000000000'}</span>
            </div>
            {client?.address && (
              <div className="col-span-2">
                <span className="font-bold text-slate-700">{t('print_address')} </span>
                <span className="text-slate-800">{client.address}{client.city ? `, ${client.city}` : ''}</span>
              </div>
            )}
            {client?.email && (
              <div>
                <span className="font-bold text-slate-700">{t('print_email')} </span>
                <span className="text-slate-800">{client.email}</span>
              </div>
            )}
            {client?.phone && (
              <div>
                <span className="font-bold text-slate-700">Tel: </span>
                <span className="text-slate-800">{client.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* === LINE ITEMS TABLE === */}
        <div className="px-10 py-4">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className={tc.tableHead}>
                <th className={`text-left px-3 py-2.5 font-semibold rounded-tl ${tc.tableHeadText}`}>DESCRIPCIÓN / COMENTARIOS</th>
                <th className={`text-center px-3 py-2.5 font-semibold w-16 ${tc.tableHeadText}`}>{t('print_qty')}</th>
                <th className={`text-right px-3 py-2.5 font-semibold w-24 ${tc.tableHeadText}`}>{t('print_unit_price')}</th>
                <th className={`text-right px-3 py-2.5 font-semibold w-24 rounded-tr ${tc.tableHeadText}`}>{t('print_total')}</th>
              </tr>
            </thead>
            <tbody>
              {paddedItems.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-3 py-2 border-b border-slate-100 min-h-[28px]">{item?.description ?? ''}</td>
                  <td className="px-3 py-2 border-b border-slate-100 text-center">{item ? item.quantity : ''}</td>
                  <td className="px-3 py-2 border-b border-slate-100 text-right">{item ? formatMoney(item.unit_price) : ''}</td>
                  <td className="px-3 py-2 border-b border-slate-100 text-right font-medium">{item ? formatMoney(item.line_total) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* === TOTALS === */}
        <div className="px-10 pb-6 flex justify-end">
          <table className="text-xs border-collapse" style={{ minWidth: 240 }}>
            <tbody>
              <tr className={tc.tableHead}>
                <td className={`px-4 py-2 font-bold uppercase ${tc.tableHeadText}`}>MONTO EN {currency}</td>
                <td className={`px-4 py-2 font-bold text-right ${tc.tableHeadText}`}>${formatMoney(invoice.subtotal)}</td>
              </tr>
              <tr className="border border-slate-300">
                <td className="px-4 py-1.5 font-semibold text-slate-600">{t('print_subtotal')}</td>
                <td className="px-4 py-1.5 text-right text-slate-800">${formatMoney(invoice.subtotal)}</td>
              </tr>
              <tr className="border border-slate-300 bg-slate-50">
                <td className="px-4 py-1.5 font-semibold text-slate-600">{regionConfig.taxLabel} {itbisRate}%</td>
                <td className="px-4 py-1.5 text-right text-slate-800">{itbisRate > 0 ? formatMoney(invoice.tax_amount) : '0.00'}</td>
              </tr>
              {invoice.discount_amount > 0 && (
                <tr className="border border-slate-300">
                  <td className="px-4 py-1.5 font-semibold text-slate-600">{t('print_discount')}</td>
                  <td className="px-4 py-1.5 text-right text-slate-800">-{formatMoney(invoice.discount_amount)}</td>
                </tr>
              )}
              <tr className={tc.totalRow}>
                <td className={`px-4 py-2.5 font-black text-sm ${tc.totalRowText}`}>{t('print_total')}</td>
                <td className={`px-4 py-2.5 font-black text-sm text-right ${tc.totalRowText}`}>${formatMoney(invoice.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* === BANKING DETAILS === */}
        {(bankName || bankAccount || bankIban) && (
          <div className={`mx-10 mb-6 p-4 border-t-2 ${tc.borderColor} text-xs text-slate-700 leading-relaxed`}>
            {bankName && <p>Todos los cheques y/o transferencias a nombre de: <strong>{bankName}</strong></p>}
            {bankAccount && <p>Transferencias a <strong>{getSetting('bank_bank_name') || 'Banco'}</strong>, Cuenta Corriente / <strong>{bankAccount}</strong></p>}
            {bankIban && <p>Cuenta Regional / <strong>{bankIban}</strong></p>}
            {(bankContact || bankContactTel || bankContactEmail) && (
              <p className="mt-2">
                Si tiene preguntas sobre esta factura, comuníquese con nosotros.{' '}
                {bankContact && <strong>{bankContact}</strong>}
                {bankContactTel && <> Tel: <strong>{bankContactTel}</strong></>}
                {bankContactEmail && <> / E-mail: <strong className="text-sky-700">{bankContactEmail}</strong></>}
              </p>
            )}
          </div>
        )}

        {/* === NOTES === */}
        {invoice.notes && (
          <div className="mx-10 mb-6 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed">
            {invoice.notes}
          </div>
        )}

        {/* === FOOTER === */}
        <div className={`px-10 pb-8 flex items-center justify-between border-t-2 ${tc.borderColor} pt-4`}>
          <div className="text-xs text-slate-400">
            <p>{companyName}</p>
            {companyPhone && <p>Tel: {companyPhone}</p>}
            {companyEmail && <p>{companyEmail}</p>}
          </div>
          <div className="text-xs text-slate-400 text-right">
            <p>{t('print_invoice')} #{invoice.invoice_number}</p>
            <p>{t('print_date')} {formatDate(invoice.issue_date)}</p>
            {invoice.due_date && <p>Vence: {formatDate(invoice.due_date)}</p>}
          </div>
        </div>

        {theme !== 'minimal' && <div className={`h-2 w-full ${tc.accentBg}`} />}
      </div>
    </div>
  );
}

function getPrintStyles(): string {
  return `
    .invoice-paper { max-width: 780px; margin: 0 auto; }
    table { border-collapse: collapse; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      @page { margin: 10mm; size: A4; }
    }
  `;
}
