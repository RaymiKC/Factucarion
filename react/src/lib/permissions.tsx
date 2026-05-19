import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// PAGE REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_PAGES = [
  'dashboard',
  'invoices',
  'clients',
  'products',
  'payments',
  'electronic',
  'email',
  'notifications',
  'analytics',
  'admin',
] as const;

export type AppPage = typeof ALL_PAGES[number];

export interface PageAction {
  key: 'can_create' | 'can_edit' | 'can_delete';
  label: string;
}

export interface PageDefinition {
  id: AppPage;
  label: string;
  actions: PageAction[];
}

export const PAGE_REGISTRY: PageDefinition[] = [
  { id: 'dashboard',     label: 'Dashboard',                  actions: [] },
  { id: 'invoices',      label: 'Facturas',                   actions: [{ key: 'can_create', label: 'Crear factura' }, { key: 'can_edit', label: 'Editar / pagar' }, { key: 'can_delete', label: 'Cancelar / eliminar' }] },
  { id: 'clients',       label: 'Clientes',                   actions: [{ key: 'can_create', label: 'Agregar cliente' }, { key: 'can_edit', label: 'Editar cliente' }, { key: 'can_delete', label: 'Eliminar cliente' }] },
  { id: 'products',      label: 'Productos / Servicios',      actions: [{ key: 'can_create', label: 'Agregar producto' }, { key: 'can_edit', label: 'Editar producto' }, { key: 'can_delete', label: 'Eliminar producto' }] },
  { id: 'payments',      label: 'Pagos',                      actions: [{ key: 'can_create', label: 'Registrar pago' }, { key: 'can_edit', label: 'Editar pago' }, { key: 'can_delete', label: 'Eliminar pago' }] },
  { id: 'electronic',    label: 'Facturación Electrónica',    actions: [{ key: 'can_create', label: 'Enviar e-CF' }, { key: 'can_edit', label: 'Reenviar / actualizar' }] },
  { id: 'email',         label: 'Prog. Email',                actions: [{ key: 'can_create', label: 'Crear programa' }, { key: 'can_edit', label: 'Editar programa' }, { key: 'can_delete', label: 'Eliminar programa' }] },
  { id: 'notifications', label: 'Notificaciones',             actions: [{ key: 'can_delete', label: 'Marcar como leído / borrar' }] },
  { id: 'analytics',     label: 'Analítica',                  actions: [] },
  { id: 'admin',         label: 'Administración',             actions: [{ key: 'can_create', label: 'Crear empresas / usuarios' }, { key: 'can_edit', label: 'Editar configuración' }, { key: 'can_delete', label: 'Eliminar registros' }] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RolePermission {
  id: string;
  role: string;
  page: AppPage;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export type PagePermission = Pick<RolePermission, 'can_view' | 'can_create' | 'can_edit' | 'can_delete'>;

export interface UserPermission {
  id: string;
  user_id: string;
  page: AppPage;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface CustomRole {
  id: string;
  name: string;
  label: string;
  description: string;
  color: string;
  is_system: boolean;
  created_at: string;
}

const FULL: PagePermission = { can_view: true, can_create: true, can_edit: true, can_delete: true };
const NONE: PagePermission = { can_view: false, can_create: false, can_edit: false, can_delete: false };

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface PermissionsContextValue {
  // All role-level permissions (for admin panel)
  allPermissions: RolePermission[];
  loadingAll: boolean;
  refetchAll: () => void;
  updatePermission: (role: string, page: AppPage, field: keyof PagePermission, value: boolean) => Promise<void>;

  // Per-user permission overrides
  allUserPermissions: UserPermission[];
  loadingUserPerms: boolean;
  refetchUserPerms: () => void;
  getUserPerms: (userId: string) => UserPermission[];
  updateUserPermission: (userId: string, page: AppPage, field: keyof PagePermission, value: boolean) => Promise<void>;
  seedUserPermissionsFromRole: (userId: string, role: string) => Promise<void>;
  resetUserPermissions: (userId: string) => Promise<void>;

  // Custom role management
  customRoles: CustomRole[];
  rolesLoading: boolean;
  createRole: (data: { name: string; label: string; description: string; color: string }) => Promise<{ error?: string }>;
  updateRole: (id: string, data: Partial<Pick<CustomRole, 'label' | 'description' | 'color'>>) => Promise<void>;
  deleteRole: (id: string, name: string) => Promise<{ error?: string }>;
  copyPermissions: (fromRole: string, toRole: string) => Promise<void>;
  refetchRoles: () => void;

  // Current user's resolved permissions
  userPermissions: Record<AppPage, PagePermission>;
  canView: (page: AppPage) => boolean;
  canCreate: (page: AppPage) => boolean;
  canEdit: (page: AppPage) => boolean;
  canDelete: (page: AppPage) => boolean;
  visiblePages: AppPage[];
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

interface PermissionsProviderProps {
  children: ReactNode;
  userRole?: string;
  isAdmin?: boolean;
  userId?: string;
}

export function PermissionsProvider({ children, userRole, isAdmin, userId }: PermissionsProviderProps) {
  const [allPermissions, setAllPermissions] = useState<RolePermission[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [allUserPermissions, setAllUserPermissions] = useState<UserPermission[]>([]);
  const [loadingUserPerms, setLoadingUserPerms] = useState(true);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoadingAll(true);
    const { data } = await supabase.from('role_permissions').select('*').order('role').order('page');
    setAllPermissions((data ?? []) as RolePermission[]);
    setLoadingAll(false);
  }, []);

  const fetchUserPerms = useCallback(async () => {
    setLoadingUserPerms(true);
    const { data } = await supabase.from('user_permissions').select('*').order('user_id').order('page');
    setAllUserPermissions((data ?? []) as UserPermission[]);
    setLoadingUserPerms(false);
  }, []);

  const fetchRoles = useCallback(async () => {
    setRolesLoading(true);
    const { data } = await supabase
      .from('custom_roles')
      .select('*')
      .order('is_system', { ascending: false })
      .order('created_at');
    setCustomRoles((data ?? []) as CustomRole[]);
    setRolesLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchUserPerms(); }, [fetchUserPerms]);
  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const updatePermission = useCallback(async (
    role: string, page: AppPage, field: keyof PagePermission, value: boolean,
  ) => {
    await supabase
      .from('role_permissions')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('role', role)
      .eq('page', page);
    fetchAll();
  }, [fetchAll]);

  const getUserPerms = useCallback((uid: string) => {
    return allUserPermissions.filter(p => p.user_id === uid);
  }, [allUserPermissions]);

  const updateUserPermission = useCallback(async (
    uid: string, page: AppPage, field: keyof PagePermission, value: boolean,
  ) => {
    // Upsert the row so it always exists
    await supabase.from('user_permissions').upsert(
      { user_id: uid, page, can_view: false, can_create: false, can_edit: false, can_delete: false, [field]: value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,page', ignoreDuplicates: false }
    );
    // Then update just the field in case row already existed
    await supabase.from('user_permissions')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('user_id', uid)
      .eq('page', page);
    fetchUserPerms();
  }, [fetchUserPerms]);

  // Seed user_permissions from their role — called on user create or role change
  const seedUserPermissionsFromRole = useCallback(async (uid: string, role: string) => {
    const rolePerms = allPermissions.filter(p => p.role === role);
    if (!rolePerms.length) return;

    const rows = rolePerms.map(rp => ({
      user_id: uid,
      page: rp.page,
      can_view: rp.can_view,
      can_create: rp.can_create,
      can_edit: rp.can_edit,
      can_delete: rp.can_delete,
      updated_at: new Date().toISOString(),
    }));

    await supabase.from('user_permissions')
      .upsert(rows, { onConflict: 'user_id,page' });

    fetchUserPerms();
  }, [allPermissions, fetchUserPerms]);

  // Remove all user-level overrides (revert to role defaults)
  const resetUserPermissions = useCallback(async (uid: string) => {
    await supabase.from('user_permissions').delete().eq('user_id', uid);
    fetchUserPerms();
  }, [fetchUserPerms]);

  const createRole = useCallback(async (data: {
    name: string; label: string; description: string; color: string;
  }) => {
    const slug = data.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!slug) return { error: 'Nombre inválido' };

    const exists = customRoles.some(r => r.name === slug);
    if (exists) return { error: 'Ya existe un rol con ese nombre' };

    const { error } = await supabase.from('custom_roles').insert({
      name: slug,
      label: data.label,
      description: data.description,
      color: data.color,
      is_system: false,
    });
    if (error) return { error: error.message };

    // Blank permissions for every registered page
    const rows = ALL_PAGES.map(page => ({
      role: slug, page,
      can_view: false, can_create: false, can_edit: false, can_delete: false,
    }));
    await supabase.from('role_permissions').insert(rows);

    await fetchRoles();
    await fetchAll();
    return {};
  }, [customRoles, fetchRoles, fetchAll]);

  const updateRole = useCallback(async (
    id: string, data: Partial<Pick<CustomRole, 'label' | 'description' | 'color'>>,
  ) => {
    await supabase
      .from('custom_roles')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);
    fetchRoles();
  }, [fetchRoles]);

  const deleteRole = useCallback(async (id: string, name: string) => {
    const role = customRoles.find(r => r.id === id);
    if (role?.is_system) return { error: 'No se pueden eliminar roles del sistema' };

    await supabase.from('role_permissions').delete().eq('role', name);
    const { error } = await supabase.from('custom_roles').delete().eq('id', id);
    if (error) return { error: error.message };

    await fetchRoles();
    await fetchAll();
    return {};
  }, [customRoles, fetchRoles, fetchAll]);

  const copyPermissions = useCallback(async (fromRole: string, toRole: string) => {
    const source = allPermissions.filter(p => p.role === fromRole);
    if (!source.length) return;

    for (const perm of source) {
      await supabase
        .from('role_permissions')
        .update({
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_edit: perm.can_edit,
          can_delete: perm.can_delete,
          updated_at: new Date().toISOString(),
        })
        .eq('role', toRole)
        .eq('page', perm.page);
    }
    fetchAll();
  }, [allPermissions, fetchAll]);

  // ── Resolve current user's effective permissions ─────────────────────────
  // Priority: admin override → per-user overrides → role defaults → NONE
  const userPermissions: Record<AppPage, PagePermission> = {} as Record<AppPage, PagePermission>;
  for (const page of ALL_PAGES) {
    if (isAdmin) {
      userPermissions[page] = FULL;
    } else {
      // Check for user-level override first
      const userPerm = userId
        ? allUserPermissions.find(p => p.user_id === userId && p.page === page)
        : undefined;

      if (userPerm) {
        userPermissions[page] = {
          can_view: userPerm.can_view,
          can_create: userPerm.can_create,
          can_edit: userPerm.can_edit,
          can_delete: userPerm.can_delete,
        };
      } else {
        // Fall back to role permission
        const perm = allPermissions.find(p => p.role === userRole && p.page === page);
        userPermissions[page] = perm
          ? { can_view: perm.can_view, can_create: perm.can_create, can_edit: perm.can_edit, can_delete: perm.can_delete }
          : NONE;
      }
    }
  }

  const canView   = (page: AppPage) => userPermissions[page]?.can_view   ?? false;
  const canCreate = (page: AppPage) => userPermissions[page]?.can_create ?? false;
  const canEdit   = (page: AppPage) => userPermissions[page]?.can_edit   ?? false;
  const canDelete = (page: AppPage) => userPermissions[page]?.can_delete ?? false;

  const visiblePages = ALL_PAGES.filter(p => canView(p));

  return (
    <PermissionsContext.Provider value={{
      allPermissions, loadingAll, refetchAll: fetchAll, updatePermission,
      allUserPermissions, loadingUserPerms, refetchUserPerms: fetchUserPerms,
      getUserPerms, updateUserPermission, seedUserPermissionsFromRole, resetUserPermissions,
      customRoles, rolesLoading, createRole, updateRole, deleteRole, copyPermissions, refetchRoles: fetchRoles,
      userPermissions, canView, canCreate, canEdit, canDelete, visiblePages,
    }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used inside PermissionsProvider');
  return ctx;
}
