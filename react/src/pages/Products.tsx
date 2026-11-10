import { useState } from 'react';
import { Plus, Search, CreditCard as Edit2, Trash2, Package, Wrench } from 'lucide-react';
import { db } from '../lib/db';
import { useProducts, useTaxRates } from '../lib/hooks';
import type { ProductService } from '../lib/types';
import Modal from '../components/Modal';
import { useI18n } from '../lib/i18n';
import { usePermissions } from '../lib/permissions';

const emptyProduct: Omit<ProductService, 'id' | 'created_at' | 'updated_at' | 'tax_rate'> = {
  code: '', name: '', description: '', type: 'service', unit_price: 0,
  tax_rate_id: null, unit: 'unidad', is_active: true,
};

interface ProductsProps {
  companyId?: string;
}

export default function Products({ companyId }: ProductsProps) {
  const { t, formatCurrency } = useI18n();
  const { canCreate, canEdit } = usePermissions();
  const { products, loading, refetch } = useProducts(companyId);
  const { taxRates } = useTaxRates(companyId);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ProductService | null>(null);
  const [form, setForm] = useState({ ...emptyProduct });
  const [saving, setSaving] = useState(false);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyProduct });
    setShowModal(true);
  }

  function openEdit(p: ProductService) {
    setEditing(p);
    setForm({ code: p.code, name: p.name, description: p.description, type: p.type, unit_price: p.unit_price, tax_rate_id: p.tax_rate_id, unit: p.unit, is_active: p.is_active });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editing) {
      await db.from('products_services').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id);
    } else {
      await db.from('products_services').insert({ ...form, ...(companyId ? { company_id: companyId } : {}) });
    }
    setSaving(false);
    setShowModal(false);
    refetch();
  }

  async function toggleActive(p: ProductService) {
    await db.from('products_services').update({ is_active: !p.is_active }).eq('id', p.id);
    refetch();
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t('products_title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{products.filter(p => p.is_active).length} ítems activos en catálogo</p>
        </div>
        {canCreate('products') && (
          <button onClick={openCreate} className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg whitespace-nowrap shrink-0 transition-colors">
            <Plus size={15} /> {t('new_product')}
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder={t('search_products')} value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500" />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">{t('loading_products')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Package size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('no_products')}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('add_first_product')}</p>
          </div>
        ) : (
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden md:table-cell">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:table-cell">Tipo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Precio</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 hidden lg:table-cell">ITBIS</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Estado</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${p.type === 'product' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                          {p.type === 'product' ? <Package size={14} className="text-amber-600" /> : <Wrench size={14} className="text-blue-600" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.name}</p>
                          {p.description && <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-xs">{p.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{p.code || '-'}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs font-medium ${p.type === 'product' ? 'text-amber-600' : 'text-blue-600'}`}>
                        {p.type === 'product' ? t('product_type_product') : t('product_type_service')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(p.unit_price)}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">/{p.unit}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{p.tax_rate ? `${p.tax_rate.rate}%` : 'Exento'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(p)}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${p.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {p.is_active ? t('active') : t('inactive')}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit('products') && (
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                            <Edit2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map(p => (
              <div key={p.id} className="p-4 flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${p.type === 'product' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                  {p.type === 'product' ? <Package size={16} className="text-amber-600" /> : <Wrench size={16} className="text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{p.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                        {p.type === 'product' ? t('product_type_product') : t('product_type_service')}
                        {p.code ? ` · ${p.code}` : ''}
                      </p>
                    </div>
                    <button onClick={() => toggleActive(p)}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.is_active ? t('active') : t('inactive')}
                    </button>
                  </div>
                  <div className="flex items-end justify-between gap-2 pt-1">
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {formatCurrency(p.unit_price)}<span className="text-xs text-slate-400 dark:text-slate-500 font-normal">/{p.unit}</span>
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{p.tax_rate ? `${p.tax_rate.rate}%` : 'Exento'}</p>
                    </div>
                    {canEdit('products') && (
                      <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400">
                        <Edit2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? t('update_product_btn') : t('new_product')} size="lg">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('product_type')}</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'product' | 'service' }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500">
                <option value="service">{t('product_type_service')}</option>
                <option value="product">{t('product_type_product')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('product_code')}</label>
              <input type="text" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="SRV-001" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('product_name')} *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="Nombre del producto o servicio" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('description')}</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('unit_price')}</label>
              <input type="number" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500" min={0} step={0.01} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Unidad</label>
              <input type="text" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500" placeholder="unidad, hora, mes..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{t('tax_rate_label')}</label>
              <select value={form.tax_rate_id ?? ''} onChange={e => setForm(f => ({ ...f, tax_rate_id: e.target.value || null }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500">
                <option value="">Sin impuesto</option>
                {taxRates.map(tr => <option key={tr.id} value={tr.id}>{tr.name} ({tr.rate}%)</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">{t('cancel')}</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-50">
              {saving ? t('saving') : editing ? t('update_product_btn') : t('create_product_btn')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
