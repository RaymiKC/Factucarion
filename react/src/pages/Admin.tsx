import { useState, useEffect } from 'react';
import { Settings, Users, Zap, Mail, Save, Plus, CreditCard as Edit2, Trash2, ToggleLeft, ToggleRight, Building2, DollarSign, Percent, RefreshCw, Landmark, Database, Shield, CheckCircle, Globe, Lock, Eye, PenLine, FilePlus, Copy, ChevronDown, ChevronRight as ChevronRightIcon, X, Tag, Upload, Image as ImageIcon, Palette, AlertTriangle, Key, Smartphone, RotateCcw, Check } from 'lucide-react';
import { db } from '../lib/db';
import { useSettings, useFeatureFlags, useUsersConfig, useTaxRates, useCompanyUsers } from '../lib/hooks';
import { useCompany, type Company } from '../lib/company';
import { usePermissions, PAGE_REGISTRY, type AppPage, type PagePermission, type RolePermission, type CustomRole, type UserPermission } from '../lib/permissions';
import type { UserConfig, TaxRate } from '../lib/types';
import Modal from '../components/Modal';
import { API_BASE } from '../lib/db';
import { useI18n, REGIONS, type Language, type Region } from '../lib/i18n';
import { generateTempPassword, sendWelcomeEmail } from '../lib/auth';

type AdminTab = 'companies' | 'company' | 'invoices' | 'banking' | 'users' | 'permissions' | 'features' | 'taxes' | 'email' | 'region' | 'database';

const BUILT_IN_ROLES = ['admin', 'manager', 'assistant', 'operator', 'viewer'] as const;
type BuiltInRole = typeof BUILT_IN_ROLES[number];


const ROLE_LABELS: Record<BuiltInRole, string> = {
  admin:     'Administrador',
  manager:   'Gerente',
  assistant: 'Asistente',
  operator:  'Operador',
  viewer:    'Visor',
};

const ROLE_COLORS: Record<BuiltInRole, string> = {
  admin:     'bg-sky-100 text-sky-700 border-sky-200',
  manager:   'bg-teal-100 text-teal-700 border-teal-200',
  assistant: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  operator:  'bg-amber-100 text-amber-700 border-amber-200',
  viewer:    'bg-slate-100 text-slate-600 border-slate-200',
};

const ROLE_DESC: Record<BuiltInRole, string> = {
  admin:     'Acceso total al sistema — no modificable',
  manager:   'Gestiona empresas asignadas — acceso operacional completo',
  assistant: 'Soporte en empresas asignadas — crea pero no borra',
  operator:  'Operaciones del día a día — facturas y clientes',
  viewer:    'Solo lectura — no puede crear ni modificar nada',
};

const AVAILABLE_COLORS = [
  { key: 'sky',     bg: 'bg-sky-100',     text: 'text-sky-700',     border: 'border-sky-200',     dot: 'bg-sky-500'     },
  { key: 'teal',    bg: 'bg-teal-100',    text: 'text-teal-700',    border: 'border-teal-200',    dot: 'bg-teal-500'    },
  { key: 'emerald', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { key: 'amber',   bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500'   },
  { key: 'rose',    bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500'    },
  { key: 'slate',   bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-200',   dot: 'bg-slate-400'   },
  { key: 'orange',  bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-200',  dot: 'bg-orange-500'  },
  { key: 'cyan',    bg: 'bg-cyan-100',    text: 'text-cyan-700',    border: 'border-cyan-200',    dot: 'bg-cyan-500'    },
] as const;

function getRoleColor(color: string) {
  return AVAILABLE_COLORS.find(c => c.key === color) ?? AVAILABLE_COLORS[5];
}

// Icons mapped to permission field keys — used in the matrix header
const PERM_ICONS: Record<keyof PagePermission, React.ElementType> = {
  can_view:   Eye,
  can_create: FilePlus,
  can_edit:   PenLine,
  can_delete: Trash2,
};

interface PermissionsTabProps {
  allPermissions: RolePermission[];
  permLoading: boolean;
  updatePermission: (role: string, page: AppPage, field: keyof PagePermission, value: boolean) => Promise<void>;
  customRoles: CustomRole[];
  rolesLoading: boolean;
  createRole: (data: { name: string; label: string; description: string; color: string }) => Promise<{ error?: string }>;
  updateRole: (id: string, data: Partial<Pick<CustomRole, 'label' | 'description' | 'color'>>) => Promise<void>;
  deleteRole: (id: string, name: string) => Promise<{ error?: string }>;
  copyPermissions: (fromRole: string, toRole: string) => Promise<void>;
}

// ── Role permission matrix row ──────────────────────────────────────────────
function RoleMatrix({
  role, label, description, color, isSystem, allPermissions, updatePermission,
}: {
  role: string; label: string; description: string; color: string; isSystem: boolean;
  allPermissions: RolePermission[];
  updatePermission: (role: string, page: AppPage, field: keyof PagePermission, value: boolean) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(!isSystem || role !== 'admin');
  const c = getRoleColor(color);

  const getPerm = (page: AppPage) => allPermissions.find(p => p.role === role && p.page === page);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
      >
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border}`}>
          <Shield size={11} />
          {label}
        </span>
        {isSystem && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">sistema</span>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500 flex-1">{description}</p>
        <span className="text-slate-400 dark:text-slate-500 shrink-0">
          {expanded ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
        </span>
      </button>

      {expanded && (
        role === 'admin' ? (
          <div className="px-5 py-4 flex flex-wrap gap-2">
            {PAGE_REGISTRY.map(pg => (
              <span key={pg.id} className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-700 border border-sky-100 px-2.5 py-1 rounded-full font-medium">
                <CheckCircle size={10} />
                {pg.label}
              </span>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 w-56">Página</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 min-w-[64px]">
                    <span className="flex items-center justify-center gap-1"><Eye size={11} />Ver</span>
                  </th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Acciones disponibles</th>
                </tr>
              </thead>
              <tbody>
                {PAGE_REGISTRY.map(pg => {
                  const perm = getPerm(pg.id);
                  const viewOn = perm?.can_view ?? false;
                  return (
                    <tr key={pg.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      {/* Page name */}
                      <td className="px-5 py-3">
                        <div>
                          <p className="font-medium text-slate-700 dark:text-slate-200">{pg.label}</p>
                          {pg.actions.length === 0 && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Solo lectura</p>
                          )}
                        </div>
                      </td>

                      {/* can_view toggle */}
                      <td className="text-center px-3 py-3">
                        <button
                          onClick={async () => {
                            await updatePermission(role, pg.id, 'can_view', !viewOn);
                            if (viewOn) {
                              // turning off view — clear all sub-actions
                              for (const a of pg.actions) {
                                await updatePermission(role, pg.id, a.key, false);
                              }
                            }
                          }}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${viewOn ? 'bg-sky-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${viewOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                      </td>

                      {/* Per-page action toggles */}
                      <td className="px-5 py-3">
                        {pg.actions.length === 0 ? (
                          <span className="text-[10px] text-slate-300 dark:text-slate-600 italic">Sin acciones de escritura</span>
                        ) : (
                          <div className="flex flex-wrap gap-3">
                            {pg.actions.map(action => {
                              const val = perm?.[action.key] ?? false;
                              const disabled = !viewOn;
                              const Icon = PERM_ICONS[action.key];
                              return (
                                <button
                                  key={action.key}
                                  onClick={async () => {
                                    if (disabled) return;
                                    await updatePermission(role, pg.id, action.key, !val);
                                  }}
                                  disabled={disabled}
                                  title={disabled ? 'Activa "Ver" primero' : action.label}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                                    ${val && !disabled
                                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                                      : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                    }`}
                                >
                                  <Icon size={10} />
                                  {action.label}
                                  <span className={`w-1.5 h-1.5 rounded-full ${val && !disabled ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

// ── Create / Edit role modal ─────────────────────────────────────────────────
interface RoleFormModalProps {
  mode: 'create' | 'edit';
  initial?: CustomRole;
  allRoles: CustomRole[];
  onSave: (data: { name: string; label: string; description: string; color: string }) => Promise<{ error?: string }>;
  onClose: () => void;
}

function RoleFormModal({ mode, initial, allRoles, onSave, onClose }: RoleFormModalProps) {
  const [name, setName]         = useState(initial?.name ?? '');
  const [label, setLabel]       = useState(initial?.label ?? '');
  const [desc, setDesc]         = useState(initial?.description ?? '');
  const [color, setColor]       = useState(initial?.color ?? 'slate');
  const [err, setErr]           = useState('');
  const [saving, setSaving]     = useState(false);

  const handleSave = async () => {
    if (!label.trim()) { setErr('El nombre de visualización es obligatorio.'); return; }
    setSaving(true);
    const res = await onSave({ name: mode === 'edit' ? (initial?.name ?? name) : name, label, description: desc, color });
    setSaving(false);
    if (res.error) { setErr(res.error); return; }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {mode === 'create' ? 'Nuevo tipo de usuario' : 'Editar tipo de usuario'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {mode === 'create' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Clave interna <span className="text-slate-400 dark:text-slate-500">(slug, sin espacios)</span></label>
              <input
                value={name}
                onChange={e => setName(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))}
                placeholder="ej. supervisor_ventas"
                className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Nombre de visualización</label>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="ej. Supervisor de Ventas"
              className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Descripción <span className="text-slate-400 dark:text-slate-500">(opcional)</span></label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={2}
              placeholder="Describe brevemente las responsabilidades de este rol"
              className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Color de identificación</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_COLORS.map(c => (
                <button
                  key={c.key}
                  onClick={() => setColor(c.key)}
                  className={`w-7 h-7 rounded-full ${c.dot} transition-all ${color === c.key ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'opacity-70 hover:opacity-100'}`}
                  title={c.key}
                />
              ))}
            </div>
            <div className="mt-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getRoleColor(color).bg} ${getRoleColor(color).text} ${getRoleColor(color).border}`}>
                <Shield size={11} />
                {label || 'Vista previa'}
              </span>
            </div>
          </div>

          {err && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</p>}
        </div>

        <div className="px-6 pb-5 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? 'Guardando...' : mode === 'create' ? 'Crear tipo' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Copy permissions modal ───────────────────────────────────────────────────
function CopyPermissionsModal({
  allRoles, onCopy, onClose,
}: {
  allRoles: CustomRole[];
  onCopy: (from: string, to: string) => Promise<void>;
  onClose: () => void;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const valid = from && to && from !== to;

  const handle = async () => {
    if (!valid) return;
    setSaving(true);
    await onCopy(from, to);
    setSaving(false);
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Copiar permisos</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors">
            <X size={15} />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-8 text-center">
            <CheckCircle size={32} className="text-emerald-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Permisos copiados exitosamente</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Los permisos de <span className="font-medium">{allRoles.find(r => r.name === from)?.label}</span> se copiaron a <span className="font-medium">{allRoles.find(r => r.name === to)?.label}</span>
            </p>
            <button onClick={onClose} className="mt-5 px-4 py-2 text-sm bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors font-medium">
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Los permisos del rol origen se copiarán al rol destino, reemplazando los existentes.</p>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Rol origen <span className="text-slate-400 dark:text-slate-500">(copiar desde)</span></label>
                <select
                  value={from}
                  onChange={e => setFrom(e.target.value)}
                  className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 bg-slate-50 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Seleccionar...</option>
                  {allRoles.map(r => (
                    <option key={r.name} value={r.name}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                  <div className="w-8 h-px bg-slate-200 dark:bg-slate-700" />
                  <Copy size={12} />
                  <div className="w-8 h-px bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Rol destino <span className="text-slate-400 dark:text-slate-500">(pegar a)</span></label>
                <select
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 bg-slate-50 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Seleccionar...</option>
                  {allRoles.filter(r => r.name !== from && r.name !== 'admin').map(r => (
                    <option key={r.name} value={r.name}>{r.label}</option>
                  ))}
                </select>
              </div>

              {from && to && from === to && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">El origen y destino deben ser distintos.</p>
              )}
            </div>

            <div className="px-6 pb-5 flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handle}
                disabled={!valid || saving}
                className="px-4 py-2 text-sm bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 transition-colors font-medium flex items-center gap-1.5"
              >
                <Copy size={12} />
                {saving ? 'Copiando...' : 'Copiar permisos'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main permissions tab ─────────────────────────────────────────────────────
function PermissionsTab({ allPermissions, permLoading, updatePermission, customRoles, rolesLoading, createRole, updateRole, deleteRole, copyPermissions }: PermissionsTabProps) {
  const [showCreateModal, setShowCreateModal]   = useState(false);
  const [editingRole, setEditingRole]           = useState<CustomRole | null>(null);
  const [showCopyModal, setShowCopyModal]       = useState(false);
  const [deleteConfirm, setDeleteConfirm]       = useState<CustomRole | null>(null);
  const [deleteErr, setDeleteErr]               = useState('');
  const [activeSection, setActiveSection]       = useState<'roles' | 'matrix'>('roles');

  const handleDelete = async (role: CustomRole) => {
    const res = await deleteRole(role.id, role.name);
    if (res?.error) { setDeleteErr(res.error); return; }
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Lock size={16} className="text-slate-500 dark:text-slate-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tipos de Usuario y Permisos</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Crea y gestiona tipos de usuario personalizados. Define qué páginas y acciones puede realizar cada tipo.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowCopyModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Copy size={12} />
              Copiar permisos
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
            >
              <Plus size={12} />
              Nuevo tipo
            </button>
          </div>
        </div>

        {/* Section toggle */}
        <div className="flex mt-4 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden w-fit">
          <button
            onClick={() => setActiveSection('roles')}
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${activeSection === 'roles' ? 'bg-sky-500 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
          >
            <span className="flex items-center gap-1.5"><Tag size={11} />Tipos de usuario</span>
          </button>
          <button
            onClick={() => setActiveSection('matrix')}
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${activeSection === 'matrix' ? 'bg-sky-500 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
          >
            <span className="flex items-center gap-1.5"><Lock size={11} />Matriz de permisos</span>
          </button>
        </div>
      </div>

      {/* ── Types panel ── */}
      {activeSection === 'roles' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {rolesLoading ? (
            <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">Cargando tipos...</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {customRoles.map(role => {
                const c = getRoleColor(role.color);
                const permCount = allPermissions.filter(p => p.role === role.name && p.can_view).length;
                return (
                  <div key={role.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border shrink-0 ${c.bg} ${c.text} ${c.border}`}>
                      <Shield size={11} />
                      {role.label}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{role.description || <span className="italic text-slate-300 dark:text-slate-600">Sin descripción</span>}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {role.name === 'admin' ? 'Todas' : `${permCount} páginas visibles`}
                      </span>
                      {role.is_system && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">sistema</span>
                      )}
                      {!role.is_system && (
                        <>
                          <button
                            onClick={() => setEditingRole(role)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-sky-600 transition-colors"
                            title="Editar"
                          >
                            <PenLine size={13} />
                          </button>
                          <button
                            onClick={() => { setDeleteConfirm(role); setDeleteErr(''); }}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 dark:text-slate-500 hover:text-rose-600 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                      {role.is_system && role.name !== 'admin' && (
                        <button
                          onClick={() => setEditingRole(role)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-sky-600 transition-colors"
                          title="Editar descripción y color"
                        >
                          <PenLine size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {customRoles.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">No hay tipos de usuario registrados</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Permissions matrix ── */}
      {activeSection === 'matrix' && (
        permLoading ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-sm text-slate-400 dark:text-slate-500">Cargando permisos...</div>
        ) : (
          <div className="space-y-3">
            {customRoles.map(role => (
              <RoleMatrix
                key={role.name}
                role={role.name}
                label={role.label}
                description={role.description}
                color={role.color}
                isSystem={role.is_system}
                allPermissions={allPermissions}
                updatePermission={updatePermission}
              />
            ))}
          </div>
        )
      )}

      {/* Modals */}
      {showCreateModal && (
        <RoleFormModal
          mode="create"
          allRoles={customRoles}
          onSave={createRole}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {editingRole && (
        <RoleFormModal
          mode="edit"
          initial={editingRole}
          allRoles={customRoles}
          onSave={async (data) => {
            await updateRole(editingRole.id, { label: data.label, description: data.description, color: data.color });
            return {};
          }}
          onClose={() => setEditingRole(null)}
        />
      )}

      {showCopyModal && (
        <CopyPermissionsModal
          allRoles={customRoles}
          onCopy={copyPermissions}
          onClose={() => setShowCopyModal(false)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 size={15} className="text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Eliminar tipo de usuario</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  ¿Eliminar el tipo <span className="font-medium">"{deleteConfirm.label}"</span>? Esta acción también borrará todos sus permisos configurados y no se puede deshacer.
                </p>
              </div>
            </div>
            {deleteErr && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">{deleteErr}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 text-sm bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors font-medium">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface AdminProps { companyId?: string }

export default function Admin({ companyId }: AdminProps = {}) {
  const [activeTab, setActiveTab] = useState<AdminTab>('company');
  const [apiStatus, setApiStatus] = useState<{
    database?: { ok?: boolean; provider?: string; target?: string; tables?: number };
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/health`)
      .then(response => response.json())
      .then(payload => { if (!cancelled) setApiStatus(payload); })
      .catch(() => { if (!cancelled) setApiStatus(null); });
    return () => { cancelled = true; };
  }, []);

  const { t, lang, region, setLang, setRegion, regionConfig } = useI18n();
  const { settings, getSetting, updateSetting, loading: settingsLoading } = useSettings(companyId);
  const { flags, toggle, refetch: refetchFlags } = useFeatureFlags(companyId);
  const { users, loading: usersLoading, refetch: refetchUsers } = useUsersConfig(companyId);
  const { taxRates, refetch: refetchTaxes } = useTaxRates();
  const { companies, allCompanies, loading: companiesLoading, refetch: refetchCompanies, createCompany } = useCompany();
  const { assignments, assign: assignCompany, unassign: unassignCompany } = useCompanyUsers();
  const { allPermissions, loadingAll: permLoading, updatePermission, customRoles, rolesLoading, createRole, updateRole, deleteRole, copyPermissions, getUserPerms, updateUserPermission, seedUserPermissionsFromRole, resetUserPermissions, allUserPermissions } = usePermissions();
  const [saved, setSaved] = useState(false);
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});
  const [userModal, setUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserConfig | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'operator' as UserConfig['role'], is_active: true, email_language: 'es' });
  const [userPermsModal, setUserPermsModal] = useState(false);
  const [permsTargetUser, setPermsTargetUser] = useState<UserConfig | null>(null);
  const [taxModal, setTaxModal] = useState(false);
  const [editingTax, setEditingTax] = useState<TaxRate | null>(null);
  const [taxForm, setTaxForm] = useState({ name: '', rate: 0, description: '' });
  const [tempPasswordModal, setTempPasswordModal] = useState(false);
  const [tempPasswordValue, setTempPasswordValue] = useState('');
  const [tempPasswordUserName, setTempPasswordUserName] = useState('');
  const [resetTablesModal, setResetTablesModal] = useState(false);
  const [resetTablesLoading, setResetTablesLoading] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  const emptyCompanyForm = { name: '', rnc: '', address: '', phone: '', email: '', country: 'DO', is_active: true };
  const [companyModal, setCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState({ ...emptyCompanyForm });

  async function saveCompany() {
    if (editingCompany) {
      await db.from('companies').update({
        name: companyForm.name,
        rnc: companyForm.rnc,
        address: companyForm.address,
        phone: companyForm.phone,
        email: companyForm.email,
        country: companyForm.country,
        is_active: companyForm.is_active,
        updated_at: new Date().toISOString(),
      }).eq('id', editingCompany.id);
      refetchCompanies();
    } else {
      await createCompany(companyForm);
    }
    setCompanyModal(false);
  }

  const getVal = (key: string) => localSettings[key] ?? getSetting(key);
  const setVal = (key: string, value: string) => setLocalSettings(s => ({ ...s, [key]: value }));

  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  async function handleLogoUpload(file: File) {
    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
      const path = `logos/${companyId ?? 'default'}/logo.${ext}`;
      const { error } = await db.storage.from('company-assets').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: urlData } = db.storage.from('company-assets').getPublicUrl(path);
      const url = urlData.publicUrl;
      setLogoPreview(url);
      await updateSetting('company_logo_url', url);
    } catch {
      // fallback: store base64 for offline use
      const reader = new FileReader();
      reader.onload = async () => {
        const b64 = reader.result as string;
        setLogoPreview(b64);
        await updateSetting('company_logo_url', b64);
      };
      reader.readAsDataURL(file);
    } finally {
      setLogoUploading(false);
    }
  }

  async function saveSettings() {
    for (const [key, value] of Object.entries(localSettings)) {
      await updateSetting(key, value);
    }
    setLocalSettings({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function saveUser() {
    if (editingUser) {
      await db.from('users_config').update({
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
        is_active: userForm.is_active,
        email_language: userForm.email_language,
        updated_at: new Date().toISOString(),
      }).eq('id', editingUser.id);
      if (userForm.role !== editingUser.role) {
        await seedUserPermissionsFromRole(editingUser.id, userForm.role);
      }
    } else {
      const tempPass = generateTempPassword();
      const { data: newUser } = await db.from('users_config').insert({
        ...userForm,
        // The API hashes temp_password with bcrypt before storing it.
        temp_password: tempPass,
        must_change_password: true,
      }).select().single();
      if (newUser) {
        await seedUserPermissionsFromRole(newUser.id, userForm.role);
        // Send welcome email in user's preferred language
        await sendWelcomeEmail(userForm.email, userForm.name, tempPass, userForm.email_language);
        setTempPasswordValue(tempPass);
        setTempPasswordUserName(userForm.name);
        setTempPasswordModal(true);
      }
    }
    setUserModal(false);
    refetchUsers();
  }

  async function toggleUser(user: UserConfig) {
    await db.from('users_config').update({ is_active: !user.is_active }).eq('id', user.id);
    refetchUsers();
  }

  async function toggleUserOtp(user: UserConfig) {
    await db.from('users_config').update({ otp_enabled: !user.otp_enabled }).eq('id', user.id);
    refetchUsers();
  }

  async function resetAllTables() {
    setResetTablesLoading(true);
    const tables = [
      'invoice_items', 'invoices', 'payment_records', 'clients', 'products_services',
      'expenses', 'ncf_sequences', 'email_schedules',
      'notifications', 'company_users', 'otp_tokens',
    ];
    for (const t of tables) {
      await db.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
    // Delete non-admin users
    await db.from('users_config').delete().neq('role', 'admin');
    // Reset admin password (the API hashes the supplied "password")
    await db.from('users_config').update({
      password: 'admin',
      failed_login_attempts: 0,
      locked_until: null,
      must_change_password: false,
      temp_password: null,
      otp_enabled: false,
    }).eq('role', 'admin');
    // Reset settings
    await db.from('settings').delete().neq('key', '__never__');
    // Reset feature flags to defaults
    await db.from('feature_flags').update({ is_enabled: false }).neq('name', '__never__');
    setResetTablesLoading(false);
    setResetTablesModal(false);
    setResetConfirmText('');
    refetchUsers();
    refetchFlags();
  }

  async function deleteUser(id: string) {
    await db.from('users_config').delete().eq('id', id);
    refetchUsers();
  }

  async function saveTax() {
    if (editingTax) {
      await db.from('tax_rates').update(taxForm).eq('id', editingTax.id);
    } else {
      await db.from('tax_rates').insert({ ...taxForm, company_id: companyId, is_active: true });
    }
    setTaxModal(false);
    refetchTaxes();
  }

  async function toggleTax(t: TaxRate) {
    await db.from('tax_rates').update({ is_active: !t.is_active }).eq('id', t.id);
    refetchTaxes();
  }

  const tabs: { id: AdminTab; label: string; icon: typeof Settings }[] = [
    { id: 'companies', label: 'Empresas',        icon: Building2 },
    { id: 'company',  label: t('tab_company'),  icon: Building2 },
    { id: 'invoices', label: t('tab_invoices'), icon: DollarSign },
    { id: 'banking',  label: t('tab_banking'),  icon: Landmark },
    { id: 'taxes',    label: t('tab_taxes'),    icon: Percent },
    { id: 'email',    label: t('tab_email'),    icon: Mail },
    { id: 'features', label: t('tab_features'), icon: Zap },
    { id: 'users',       label: t('tab_users'),    icon: Users },
    { id: 'permissions', label: 'Permisos',        icon: Lock },
    { id: 'region',   label: t('tab_region'),   icon: Globe },
    { id: 'database', label: t('tab_database'), icon: Database },
  ];

  const hasUnsavedChanges = Object.keys(localSettings).length > 0;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Administración</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Configuración del sistema y gestión de usuarios</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setResetConfirmText(''); setResetTablesModal(true); }}
            className="flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <RotateCcw size={14} />
            Restablecer sistema
          </button>
          {hasUnsavedChanges && (
            <button onClick={saveSettings}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              {saved ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {saved ? 'Guardado!' : 'Guardar Cambios'}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === id ? 'bg-sky-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {activeTab === 'companies' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Building2 size={16} />Empresas</h3>
            <button
              onClick={() => { setEditingCompany(null); setCompanyForm({ ...emptyCompanyForm }); setCompanyModal(true); }}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
              <Plus size={13} /> Nueva Empresa
            </button>
          </div>
          {companiesLoading ? (
            <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">Cargando empresas...</div>
          ) : companies.length === 0 ? (
            <div className="p-10 text-center text-slate-400 dark:text-slate-500">
              <Building2 size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No hay empresas configuradas</p>
              <p className="text-xs mt-1">Crea la primera empresa para comenzar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Nombre</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">RNC</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">País</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Estado</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {companies.map(co => (
                    <tr key={co.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{co.name}</p>
                        {co.email && <p className="text-xs text-slate-400 dark:text-slate-500">{co.email}</p>}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400 font-mono">{co.rnc || '—'}</td>
                      <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">{co.country}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${co.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                          {co.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => { setEditingCompany(co); setCompanyForm({ name: co.name, rnc: co.rnc, address: co.address, phone: co.phone, email: co.email, country: co.country, is_active: co.is_active }); setCompanyModal(true); }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600">
                          <Edit2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'company' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Building2 size={16} />Datos de la Empresa</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'company_name', label: 'Nombre / Razón Social', placeholder: 'Mi Empresa S.R.L.' },
              { key: 'company_rnc', label: 'RNC', placeholder: '000-00000-0' },
              { key: 'company_phone', label: 'Teléfono', placeholder: '809-000-0000' },
              { key: 'company_email', label: 'Email', placeholder: 'info@empresa.com' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
                <input type="text" value={getVal(key)} onChange={e => setVal(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Dirección</label>
              <input type="text" value={getVal('company_address')} onChange={e => setVal('company_address', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
            </div>
          </div>

          {/* Logo upload */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1.5"><ImageIcon size={13} />Logo de la Empresa</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-slate-800 overflow-hidden shrink-0">
                {(logoPreview ?? getVal('company_logo_url')) ? (
                  <img src={logoPreview ?? getVal('company_logo_url')} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <Building2 size={28} className="text-slate-300 dark:text-slate-600" />
                )}
              </div>
              <div className="flex-1">
                <label className={`flex items-center gap-2 cursor-pointer w-fit px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${logoUploading ? 'opacity-50 pointer-events-none' : 'hover:bg-sky-50 border-sky-200 text-sky-700'}`}>
                  {logoUploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                  {logoUploading ? 'Subiendo...' : 'Subir logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
                </label>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">PNG, JPG o SVG. Máx 2 MB. Aparece en facturas y reportes.</p>
                {(logoPreview ?? getVal('company_logo_url')) && (
                  <button onClick={async () => { setLogoPreview(null); await updateSetting('company_logo_url', ''); }}
                    className="text-xs text-red-500 hover:text-red-700 mt-1">Eliminar logo</button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={saveSettings} disabled={!hasUnsavedChanges}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              <Save size={14} />{saved ? 'Guardado!' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"><DollarSign size={16} />Configuración de Facturas</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Prefijo de Factura</label>
              <input type="text" value={getVal('invoice_prefix')} onChange={e => setVal('invoice_prefix', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" placeholder="FAC" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Próximo Número de Factura</label>
              <input type="number" value={getVal('next_invoice_number')} onChange={e => setVal('next_invoice_number', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" min={1} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Moneda por Defecto</label>
              <select value={getVal('currency')} onChange={e => setVal('currency', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100">
                <option value="DOP">DOP - Peso Dominicano</option>
                <option value="USD">USD - Dólar Americano</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Términos de Pago (días)</label>
              <input type="number" value={getVal('payment_terms')} onChange={e => setVal('payment_terms', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" min={0} />
            </div>
          </div>

          {/* Invoice theme selector */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1.5"><Palette size={13} />Tema de Factura</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { id: 'classic', label: 'Clásico',  accent: 'bg-slate-800',  preview: 'border-slate-800' },
                { id: 'modern',  label: 'Moderno',  accent: 'bg-sky-600',    preview: 'border-sky-600' },
                { id: 'minimal', label: 'Minimal',  accent: 'bg-slate-400',  preview: 'border-slate-400' },
                { id: 'bold',    label: 'Bold',     accent: 'bg-rose-600',   preview: 'border-rose-600' },
              ] as const).map(theme => {
                const active = (getVal('invoice_theme') || 'classic') === theme.id;
                return (
                  <button key={theme.id} onClick={() => setVal('invoice_theme', theme.id)}
                    className={`relative rounded-xl border-2 overflow-hidden transition-all ${active ? theme.preview + ' ring-2 ring-offset-1 ring-sky-400' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                    <div className={`h-10 ${theme.accent} w-full`} />
                    <div className="px-3 py-2 bg-white dark:bg-slate-800">
                      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-1.5" />
                      <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded w-full mb-1" />
                      <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded w-2/3" />
                    </div>
                    {active && <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-sky-500 rounded-full flex items-center justify-center"><CheckCircle size={10} className="text-white" /></div>}
                    <p className="text-center text-[11px] font-medium text-slate-600 dark:text-slate-400 pb-2">{theme.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={saveSettings} disabled={!hasUnsavedChanges}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              <Save size={14} />{saved ? 'Guardado!' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'taxes' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Percent size={16} />Tasas de Impuestos</h3>
            <button onClick={() => { setEditingTax(null); setTaxForm({ name: '', rate: 0, description: '' }); setTaxModal(true); }}
              className="flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:text-sky-700">
              <Plus size={14} />Agregar
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {taxRates.map(t => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{t.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{t.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-sky-600">{t.rate}%</span>
                  <button onClick={() => { setEditingTax(t); setTaxForm({ name: t.name, rate: t.rate, description: t.description }); setTaxModal(true); }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600"><Edit2 size={13} /></button>
                  <button onClick={() => toggleTax(t)}
                    className={`p-1.5 rounded-lg ${t.is_active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    {t.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'email' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Mail size={16} />Configuración SMTP</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'smtp_host', label: 'Servidor SMTP', placeholder: 'smtp.gmail.com' },
              { key: 'smtp_port', label: 'Puerto', placeholder: '587' },
              { key: 'smtp_user', label: 'Usuario SMTP', placeholder: 'usuario@gmail.com' },
              { key: 'smtp_from', label: 'Email Remitente', placeholder: 'noreply@empresa.com' },
              { key: 'smtp_name', label: 'Nombre Remitente', placeholder: 'Mi Empresa Facturación' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
                <input type={key === 'smtp_port' ? 'number' : 'text'} value={getVal(key)} onChange={e => setVal(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
              </div>
            ))}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-700">Para envío real de emails, configura las credenciales SMTP en server/.env (SMTP_HOST, SMTP_USER, SMTP_PASSWORD) y reinicia la API.</p>
          </div>
          <div className="flex justify-end">
            <button onClick={saveSettings} disabled={!hasUnsavedChanges}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              <Save size={14} />{saved ? 'Guardado!' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'banking' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Landmark size={16} />Datos Bancarios para Facturas</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Esta información aparece en el pie de cada factura impresa.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'bank_name',          label: 'Nombre del beneficiario',        placeholder: 'MI EMPRESA S.R.L.' },
              { key: 'bank_bank_name',     label: 'Nombre del Banco',               placeholder: 'Banco Popular Dominicano' },
              { key: 'bank_account',       label: 'Número de Cuenta Corriente',     placeholder: '000000000' },
              { key: 'bank_iban',          label: 'Cuenta Regional / IBAN',         placeholder: 'DO61BPDO00000000000000000' },
              { key: 'bank_contact',       label: 'Nombre del Contacto',            placeholder: 'Juan Pérez' },
              { key: 'bank_contact_tel',   label: 'Teléfono del Contacto',          placeholder: '+1-809-000-0000' },
              { key: 'bank_contact_email', label: 'Email del Contacto',             placeholder: 'cobros@miempresa.com' },
              { key: 'dgii_auth_number',   label: 'Número de Autorización DGII',    placeholder: '2003173285' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
                <input type="text" value={getVal(key)} onChange={e => setVal(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button onClick={saveSettings} disabled={!hasUnsavedChanges}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              <Save size={14} />{saved ? 'Guardado!' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'features' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Zap size={16} />Funcionalidades del Sistema</h3>
          </div>
          {flags.map(flag => (
            <div key={flag.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 capitalize">{flag.name.replace(/_/g, ' ')}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{flag.description}</p>
              </div>
              <button onClick={() => toggle(flag.id, !flag.is_enabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${flag.is_enabled ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${flag.is_enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Users size={16} />Gestión de Usuarios</h3>
            <button onClick={() => { setEditingUser(null); setUserForm({ name: '', email: '', role: 'operator', is_active: true }); setUserModal(true); }}
              className="flex items-center gap-1.5 text-sm font-medium text-sky-600 hover:text-sky-700">
              <Plus size={14} /> Agregar Usuario
            </button>
          </div>
          {usersLoading ? (
            <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">Cargando usuarios...</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map(user => {
                const userAssignedIds = assignments.filter(a => a.user_id === user.id).map(a => a.company_id);
                const isAdminUser = user.role === 'admin';
                const roleObj = customRoles.find(r => r.name === user.role);
                const roleLabel = roleObj?.label ?? user.role;
                const colorMap: Record<string, string> = { sky: 'bg-sky-100 text-sky-700', teal: 'bg-teal-100 text-teal-700', emerald: 'bg-emerald-100 text-emerald-700', amber: 'bg-amber-100 text-amber-700', slate: 'bg-slate-100 text-slate-700', rose: 'bg-rose-100 text-rose-700', red: 'bg-red-100 text-red-700', orange: 'bg-orange-100 text-orange-700', blue: 'bg-blue-100 text-blue-700' };
                const roleBadgeColor = colorMap[roleObj?.color ?? 'slate'] ?? 'bg-slate-100 text-slate-700';
                const hasUserOverrides = allUserPermissions.some(p => p.user_id === user.id);
                return (
                  <div key={user.id} className="px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center ${isAdminUser ? 'bg-sky-100' : 'bg-slate-100 dark:bg-slate-800'}`}>
                          <Shield size={16} className={isAdminUser ? 'text-sky-600' : 'text-slate-400 dark:text-slate-500'} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{user.name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadgeColor}`}>
                          {roleLabel}
                        </span>
                        {hasUserOverrides && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200" title="Tiene permisos personalizados">
                            Personalizado
                          </span>
                        )}
                        <button onClick={() => toggleUser(user)}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${user.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </button>
                        <button
                          onClick={() => toggleUserOtp(user)}
                          className={`p-1.5 rounded-lg transition-colors ${user.otp_enabled ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                          title={user.otp_enabled ? 'OTP activado — clic para desactivar' : 'OTP desactivado — clic para activar'}
                        ><Smartphone size={13} /></button>
                        <button
                          onClick={() => { setPermsTargetUser(user); setUserPermsModal(true); }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-sky-600"
                          title="Editar permisos del usuario"
                        ><Lock size={13} /></button>
                        <button onClick={() => { setEditingUser(user); setUserForm({ name: user.name, email: user.email, role: user.role, is_active: user.is_active, email_language: (user as UserConfig & { email_language?: string }).email_language ?? 'es' }); setUserModal(true); }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600"><Edit2 size={13} /></button>
                        <button onClick={() => deleteUser(user.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 dark:text-slate-500 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    {/* Company assignment for non-admin users */}
                    {!isAdminUser && allCompanies.length > 0 && (
                      <div className="mt-3 ml-12 flex flex-wrap gap-2">
                        <span className="text-xs text-slate-400 dark:text-slate-500 self-center mr-1">Empresas:</span>
                        {allCompanies.map(co => {
                          const assigned = userAssignedIds.includes(co.id);
                          return (
                            <button
                              key={co.id}
                              onClick={() => assigned ? unassignCompany(user.id, co.id) : assignCompany(user.id, co.id)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                                assigned
                                  ? 'bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-200'
                                  : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              {assigned && <Check size={10} />}
                              {co.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {!isAdminUser && allCompanies.length === 0 && (
                      <p className="mt-2 ml-12 text-xs text-slate-400 dark:text-slate-500">No hay empresas disponibles para asignar.</p>
                    )}
                    {isAdminUser && (
                      <p className="mt-2 ml-12 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1"><Shield size={10} /> Acceso a todas las empresas</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'permissions' && (
        <PermissionsTab
          allPermissions={allPermissions}
          permLoading={permLoading}
          updatePermission={updatePermission}
          customRoles={customRoles}
          rolesLoading={rolesLoading}
          createRole={createRole}
          updateRole={updateRole}
          deleteRole={deleteRole}
          copyPermissions={copyPermissions}
        />
      )}

      {activeTab === 'region' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2"><Globe size={15} />{t('region_title')}</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('region_subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Language selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wide">{t('language_label')}</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { code: 'es' as Language, flag: '🇪🇸', label: 'Español' },
                  { code: 'en' as Language, flag: '🇺🇸', label: 'English' },
                  { code: 'fr' as Language, flag: '🇫🇷', label: 'Français' },
                ] as const).map(l => (
                  <button
                    key={l.code}
                    onClick={() => setLang(l.code)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-colors ${lang === l.code ? 'border-sky-500 bg-sky-50' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  >
                    <span className="text-2xl">{l.flag}</span>
                    <span className={`text-xs font-medium ${lang === l.code ? 'text-sky-700' : 'text-slate-600 dark:text-slate-400'}`}>{l.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Region selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3 uppercase tracking-wide">{t('region_label')}</label>
              <div className="grid grid-cols-1 gap-2">
                {([
                  { code: 'DO' as Region, flag: '🇩🇴', name: 'República Dominicana', detail: 'ITBIS 18% · DOP · NCF/DGII' },
                  { code: 'US' as Region, flag: '🇺🇸', name: 'United States', detail: 'Sales Tax · USD · EIN' },
                  { code: 'CA' as Region, flag: '🇨🇦', name: 'Canada', detail: 'GST/HST 5% · CAD · BN' },
                ] as const).map(r => (
                  <button
                    key={r.code}
                    onClick={() => setRegion(r.code)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${region === r.code ? 'border-sky-500 bg-sky-50' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  >
                    <span className="text-2xl shrink-0">{r.flag}</span>
                    <div>
                      <p className={`text-sm font-semibold ${region === r.code ? 'text-sky-700' : 'text-slate-700 dark:text-slate-200'}`}>{r.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{r.detail}</p>
                    </div>
                    {region === r.code && <CheckCircle size={16} className="ml-auto text-sky-500 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active region summary */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 uppercase tracking-wide">{t('region_label')} activa</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div><span className="text-slate-400 dark:text-slate-500">Moneda</span><p className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{regionConfig.currency}</p></div>
              <div><span className="text-slate-400 dark:text-slate-500">{t('tax_rate_label')}</span><p className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{regionConfig.taxLabel} ({regionConfig.taxRate}%)</p></div>
              <div><span className="text-slate-400 dark:text-slate-500">{t('tax_id_label')}</span><p className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{regionConfig.taxIdLabel}{regionConfig.taxId2Label ? ` / ${regionConfig.taxId2Label}` : ''}</p></div>
              <div><span className="text-slate-400 dark:text-slate-500">NCF</span><p className="font-semibold text-slate-700 dark:text-slate-200 mt-0.5">{regionConfig.hasNcfSequences ? 'DGII' : '—'}</p></div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
            {t('region_note')}
          </div>
        </div>
      )}

      {activeTab === 'database' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-4"><Database size={16} />Proveedor de Base de Datos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['postgres', 'sqlserver'] as const).map(p => {
                const labels: Record<string, { name: string; desc: string }> = {
                  postgres:  { name: 'PostgreSQL',           desc: 'Servidor PostgreSQL propio' },
                  sqlserver: { name: 'Microsoft SQL Server', desc: 'Instancia local o remota de SQL Server' },
                };
                const active = apiStatus?.database?.provider === p;
                return (
                  <div key={p} className={`p-4 border-2 rounded-xl cursor-default ${active ? 'border-sky-500 bg-sky-50' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-bold ${active ? 'text-sky-700' : 'text-slate-700 dark:text-slate-200'}`}>{labels[p].name}</span>
                      {active && <span className="text-xs bg-sky-500 text-white px-2 py-0.5 rounded-full font-medium">Activo</span>}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{labels[p].desc}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <p className="font-semibold text-slate-700 dark:text-slate-200">Estado de la conexión</p>
              <p>
                API: <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded font-mono">{API_BASE}</code>
                {' · '}
                {apiStatus?.database?.ok ? 'conectada' : 'sin conexión'}
              </p>
              <p>Base de datos: <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded font-mono">{apiStatus?.database?.target ?? '—'}</code></p>
              <p className="font-semibold text-slate-700 dark:text-slate-200 pt-2">Para cambiar el proveedor:</p>
              <p>1. Edita <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded font-mono">server/.env</code>.</p>
              <p>2. Cambia <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded font-mono">DB_PROVIDER</code> a <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded font-mono">postgres</code> o <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded font-mono">sqlserver</code> y configura la cadena de conexión.</p>
              <p>3. Reinicia la API con <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded font-mono">npm run dev</code> en <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded font-mono">server/</code>.</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Scripts disponibles</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[
                { label: 'PostgreSQL – Esquema',          path: 'database/postgres/01_create_schema.sql' },
                { label: 'PostgreSQL – Datos iniciales',  path: 'database/postgres/02_seed_data.sql' },
                { label: 'PostgreSQL – Funciones',        path: 'database/postgres/03_functions.sql' },
                { label: 'PostgreSQL – Vistas',           path: 'database/postgres/04_views.sql' },
                { label: 'SQL Server – Esquema',          path: 'database/sqlserver/01_create_schema.sql' },
                { label: 'SQL Server – Datos iniciales',  path: 'database/sqlserver/02_seed_data.sql' },
                { label: 'SQL Server – Procedimientos',   path: 'database/sqlserver/03_stored_procedures.sql' },
                { label: 'SQL Server – Vistas',           path: 'database/sqlserver/04_views.sql' },
              ].map(({ label, path }) => (
                <div key={path} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Database size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-700 dark:text-slate-200 truncate">{label}</p>
                    <code className="text-slate-400 dark:text-slate-500 font-mono truncate block">{path}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Company Modal */}
      <Modal isOpen={companyModal} onClose={() => setCompanyModal(false)} title={editingCompany ? 'Editar Empresa' : 'Nueva Empresa'} size="md">
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nombre *</label>
            <input type="text" value={companyForm.name} onChange={e => setCompanyForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              placeholder="Mi Empresa S.R.L." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">RNC</label>
              <input type="text" value={companyForm.rnc} onChange={e => setCompanyForm(f => ({ ...f, rnc: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                placeholder="000-00000-0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">País</label>
              <select value={companyForm.country} onChange={e => setCompanyForm(f => ({ ...f, country: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100">
                <option value="DO">DO – República Dominicana</option>
                <option value="US">US – Estados Unidos</option>
                <option value="CA">CA – Canadá</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Dirección</label>
            <input type="text" value={companyForm.address} onChange={e => setCompanyForm(f => ({ ...f, address: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Teléfono</label>
              <input type="text" value={companyForm.phone} onChange={e => setCompanyForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                placeholder="809-000-0000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Email</label>
              <input type="email" value={companyForm.email} onChange={e => setCompanyForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                placeholder="info@empresa.com" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="coactive" checked={companyForm.is_active} onChange={e => setCompanyForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 text-sky-600 rounded" />
            <label htmlFor="coactive" className="text-sm text-slate-600 dark:text-slate-400">Empresa activa</label>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setCompanyModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancelar</button>
            <button onClick={saveCompany} disabled={!companyForm.name.trim()}
              className="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-50">
              {editingCompany ? 'Actualizar' : 'Crear Empresa'}
            </button>
          </div>
        </div>
      </Modal>

      {/* User Modal */}
      <Modal isOpen={userModal} onClose={() => setUserModal(false)} title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'} size="md">
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nombre</label>
            <input type="text" value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Email</label>
            <input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Tipo de usuario</label>
            <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value as UserConfig['role'] }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100">
              {customRoles.map(r => (
                <option key={r.name} value={r.name}>{r.label}{r.description ? ` — ${r.description}` : ''}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">El usuario heredará los permisos de este tipo. Puedes personalizarlos después.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Idioma de correos</label>
            <div className="flex gap-2">
              {([
                { code: 'es', flag: '🇪🇸', label: 'Español' },
                { code: 'en', flag: '🇺🇸', label: 'English' },
                { code: 'fr', flag: '🇫🇷', label: 'Français' },
              ] as const).map(l => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setUserForm(f => ({ ...f, email_language: l.code }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all ${
                    userForm.email_language === l.code
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span>{l.flag}</span>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">Idioma en que se enviarán los correos del sistema (OTP, bienvenida, etc.).</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="uactive" checked={userForm.is_active} onChange={e => setUserForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 text-sky-600 rounded" />
            <label htmlFor="uactive" className="text-sm text-slate-600 dark:text-slate-400">Usuario activo</label>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setUserModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancelar</button>
            <button onClick={saveUser} disabled={!userForm.name || !userForm.email}
              className="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-50">
              {editingUser ? 'Actualizar' : 'Crear Usuario'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Per-User Permissions Modal */}
      {permsTargetUser && (
        <Modal isOpen={userPermsModal} onClose={() => setUserPermsModal(false)} title={`Permisos: ${permsTargetUser.name}`} size="lg">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Tipo de usuario: <span className="font-semibold text-slate-700 dark:text-slate-200">{customRoles.find(r => r.name === permsTargetUser.role)?.label ?? permsTargetUser.role}</span>
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Los cambios aquí solo afectan a este usuario. Los permisos marcados en gris vienen del tipo de usuario.</p>
              </div>
              <button
                onClick={async () => {
                  if (confirm('¿Resetear permisos al tipo de usuario?')) {
                    await resetUserPermissions(permsTargetUser.id);
                    await seedUserPermissionsFromRole(permsTargetUser.id, permsTargetUser.role);
                  }
                }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <RefreshCw size={12} /> Resetear al tipo
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-slate-500 dark:text-slate-400 w-40">Módulo</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">Ver</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">Crear</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">Editar</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-slate-500 dark:text-slate-400">Eliminar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {PAGE_REGISTRY.map(pageDef => {
                    const userPerms = getUserPerms(permsTargetUser.id);
                    const userPerm = userPerms.find(p => p.page === pageDef.id);
                    const rolePerm = allPermissions.find(p => p.role === permsTargetUser.role && p.page === pageDef.id);
                    const actions: (keyof Pick<UserPermission, 'can_view' | 'can_create' | 'can_edit' | 'can_delete'>)[] = ['can_view', 'can_create', 'can_edit', 'can_delete'];
                    return (
                      <tr key={pageDef.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 pr-4 text-xs font-medium text-slate-700 dark:text-slate-300">{pageDef.label}</td>
                        {actions.map(field => {
                          const actionDef = field === 'can_view' ? { key: 'can_view', label: 'Ver' } : pageDef.actions.find(a => a.key === field);
                          const isApplicable = field === 'can_view' || !!actionDef;
                          const effectiveVal = userPerm ? userPerm[field] : (rolePerm ? rolePerm[field] : false);
                          const isOverridden = !!userPerm;
                          return (
                            <td key={field} className="py-2.5 px-3 text-center">
                              {isApplicable ? (
                                <button
                                  onClick={() => updateUserPermission(permsTargetUser.id, pageDef.id, field, !effectiveVal)}
                                  className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center mx-auto transition-colors ${
                                    effectiveVal
                                      ? isOverridden
                                        ? 'bg-sky-500 border-sky-500 text-white'
                                        : 'bg-sky-100 border-sky-300 text-sky-600'
                                      : isOverridden
                                        ? 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700'
                                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60'
                                  }`}
                                  title={isOverridden ? 'Permiso personalizado — clic para cambiar' : 'Heredado del tipo — clic para personalizar'}
                                >
                                  {effectiveVal && <Check size={12} />}
                                </button>
                              ) : (
                                <span className="text-slate-200 dark:text-slate-700 text-xs">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border-2 bg-sky-500 border-sky-500 inline-block" /> Personalizado (activo)</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border-2 bg-sky-100 border-sky-300 inline-block" /> Heredado (activo)</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border-2 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 inline-block" /> Personalizado (inactivo)</span>
            </div>
            <div className="flex justify-end pt-1">
              <button onClick={() => setUserPermsModal(false)} className="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-lg">Cerrar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Temp Password Modal */}
      <Modal isOpen={tempPasswordModal} onClose={() => setTempPasswordModal(false)} title="Usuario creado" size="sm">
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Key size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Contraseña temporal generada</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Entrega esta contraseña a <span className="font-medium">{tempPasswordUserName}</span>. Al iniciar sesión, el sistema le pedirá que la cambie.
              </p>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wide font-medium">Contraseña temporal</p>
            <code className="text-lg font-bold font-mono text-slate-800 dark:text-slate-100 tracking-widest select-all">
              {tempPasswordValue}
            </code>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <p className="text-xs text-amber-700">Copia esta contraseña ahora. No se mostrará de nuevo.</p>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => { navigator.clipboard?.writeText(tempPasswordValue); }}
              className="mr-2 px-3 py-2 text-sm text-sky-600 border border-sky-200 rounded-lg hover:bg-sky-50 transition-colors"
            >
              Copiar
            </button>
            <button onClick={() => setTempPasswordModal(false)} className="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-lg">
              Entendido
            </button>
          </div>
        </div>
      </Modal>

      {/* Reset All Tables Modal */}
      {resetTablesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <AlertTriangle size={18} className="text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Restablecer sistema</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Esta acción elimina <span className="font-semibold text-rose-600">todos los datos</span>: facturas, clientes, productos, pagos, usuarios (excepto admin) y configuraciones. No se puede deshacer.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 space-y-1">
                <p className="font-semibold">Se eliminará permanentemente:</p>
                <p>Todas las facturas, clientes, productos, pagos, gastos, emails programados, notificaciones, usuarios no-admin.</p>
                <p className="font-semibold mt-1">Se mantendrá:</p>
                <p>El usuario admin con contraseña restablecida a <code className="bg-rose-100 px-1 rounded font-mono">admin</code>.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Escribe <span className="font-bold text-rose-600">RESTABLECER</span> para confirmar
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={e => setResetConfirmText(e.target.value)}
                  placeholder="RESTABLECER"
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-2 justify-end">
              <button
                onClick={() => { setResetTablesModal(false); setResetConfirmText(''); }}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={resetAllTables}
                disabled={resetConfirmText !== 'RESTABLECER' || resetTablesLoading}
                className="px-4 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-40 transition-colors flex items-center gap-2"
              >
                {resetTablesLoading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Restableciendo...</>
                ) : (
                  <><RotateCcw size={14} />Restablecer sistema</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tax Modal */}
      <Modal isOpen={taxModal} onClose={() => setTaxModal(false)} title={editingTax ? 'Editar Impuesto' : 'Nuevo Impuesto'} size="sm">
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nombre</label>
            <input type="text" value={taxForm.name} onChange={e => setTaxForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" placeholder="ITBIS 18%" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Tasa (%)</label>
            <input type="number" value={taxForm.rate} onChange={e => setTaxForm(f => ({ ...f, rate: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" min={0} max={100} step={0.01} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Descripción</label>
            <input type="text" value={taxForm.description} onChange={e => setTaxForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500" />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setTaxModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancelar</button>
            <button onClick={saveTax} disabled={!taxForm.name}
              className="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-50">
              {editingTax ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
