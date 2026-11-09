import { Injectable, signal, computed } from '@angular/core';
import { DbService } from './db.service';
import { AuthService } from './auth.service';

export interface PagePermission { view: boolean; create: boolean; edit: boolean; delete: boolean; }
export interface RolePermission { id: string; role: string; page: string; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean; }
export interface UserPermission { id: string; user_id: string; page: string; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean; }
export interface CustomRole { id: string; name: string; description: string; created_at: string; }

export const PAGE_LIST = ['dashboard','invoices','clients','products','payments','electronic','email_schedules','notifications','analytics','admin','monthly_report','swagger'];

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  rolePermissions = signal<RolePermission[]>([]);
  userPermissions = signal<UserPermission[]>([]);
  customRoles = signal<CustomRole[]>([]);
  loaded = signal(false);

  visiblePages = computed(() => {
    const u = this.auth.user();
    if (!u) return [];
    if (u.role === 'admin') return PAGE_LIST;
    return PAGE_LIST.filter(p => this.canView(p));
  });

  constructor(private db: DbService, private auth: AuthService) {}

  async load(userId: string, role: string) {
    const [rp, up, cr] = await Promise.all([
      this.db.from('role_permissions').select('*').eq('role', role),
      this.db.from('user_permissions').select('*').eq('user_id', userId),
      this.db.from('custom_roles').select('*').order('name'),
    ]);
    this.rolePermissions.set((rp.data ?? []) as RolePermission[]);
    this.userPermissions.set((up.data ?? []) as UserPermission[]);
    this.customRoles.set((cr.data ?? []) as CustomRole[]);
    this.loaded.set(true);
  }

  private getPerms(page: string): PagePermission {
    const u = this.auth.user();
    if (!u) return { view: false, create: false, edit: false, delete: false };
    if (u.role === 'admin') return { view: true, create: true, edit: true, delete: true };
    const up = this.userPermissions().find(x => x.page === page);
    if (up) return { view: up.can_view, create: up.can_create, edit: up.can_edit, delete: up.can_delete };
    const rp = this.rolePermissions().find(x => x.page === page);
    if (rp) return { view: rp.can_view, create: rp.can_create, edit: rp.can_edit, delete: rp.can_delete };
    return { view: false, create: false, edit: false, delete: false };
  }

  canView(page: string) { return this.getPerms(page).view; }
  canCreate(page: string) { return this.getPerms(page).create; }
  canEdit(page: string) { return this.getPerms(page).edit; }
  canDelete(page: string) { return this.getPerms(page).delete; }

  async updatePermission(role: string, page: string, field: string, val: boolean) {
    const existing = this.rolePermissions().find(x => x.role === role && x.page === page);
    if (existing) {
      await this.db.from('role_permissions').update({ [field]: val }).eq('id', existing.id);
      this.rolePermissions.set(this.rolePermissions().map(x => x.id === existing.id ? { ...x, [field]: val } : x));
    } else {
      const row = { role, page, can_view: false, can_create: false, can_edit: false, can_delete: false, [field]: val };
      const { data } = await this.db.from('role_permissions').insert(row).select().single();
      if (data) this.rolePermissions.set([...this.rolePermissions(), data as RolePermission]);
    }
  }

  async createRole(name: string, description: string) {
    const { data } = await this.db.from('custom_roles').insert({ name, description }).select().single();
    if (data) this.customRoles.set([...this.customRoles(), data as CustomRole]);
  }

  async deleteRole(id: string) {
    await this.db.from('custom_roles').delete().eq('id', id);
    this.customRoles.set(this.customRoles().filter(r => r.id !== id));
  }
}
