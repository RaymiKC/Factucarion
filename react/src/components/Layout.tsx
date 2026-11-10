import { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard, Users, FileText, Package, Bell, Settings,
  ChevronLeft, ChevronRight, Zap, Mail, Shield, LogOut, Menu,
  CreditCard, TrendingUp, Building2, ChevronDown, Check, Plus,
  Sun, Moon, Globe, Code2, BarChart3, MoreHorizontal
} from 'lucide-react';
import { useNotifications } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useCompany } from '../lib/company';
import { usePermissions } from '../lib/permissions';
import { useTheme } from '../lib/theme';

type Page = 'dashboard' | 'clients' | 'invoices' | 'products' | 'notifications' | 'email' | 'electronic' | 'admin' | 'payments' | 'analytics' | 'swagger' | 'report';

interface LayoutProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
}

const LANG_LABELS: Record<string, string> = { es: 'ES', en: 'EN', fr: 'FR' };
const LANG_NAMES: Record<string, string> = { es: 'Español', en: 'English', fr: 'Français' };

export default function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const { unreadCount } = useNotifications();
  const { user, logout, isAdmin, updatePreferences } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { companies, currentCompany, setCurrentCompany } = useCompany();
  const { canView } = usePermissions();
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleThemeToggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    toggleTheme();
    if (user) updatePreferences({ theme: next });
  }

  function handleLangChange(l: string) {
    setLang(l as 'es' | 'en' | 'fr');
    setLangMenuOpen(false);
    if (user) updatePreferences({ language: l });
  }

  const allNavItems = [
    { id: 'dashboard' as Page, label: t('nav_dashboard'), icon: LayoutDashboard },
    { id: 'invoices' as Page, label: t('nav_invoices'), icon: FileText },
    { id: 'clients' as Page, label: t('nav_clients'), icon: Users },
    { id: 'products' as Page, label: t('nav_products'), icon: Package },
    { id: 'payments' as Page, label: t('nav_payments'), icon: CreditCard },
    { id: 'electronic' as Page, label: t('nav_electronic'), icon: Zap },
    { id: 'email' as Page, label: t('nav_email_schedules'), icon: Mail },
    { id: 'notifications' as Page, label: t('nav_notifications'), icon: Bell },
    { id: 'analytics' as Page, label: t('nav_analytics'), icon: TrendingUp },
    { id: 'report'    as Page, label: 'Reporte Mensual', icon: BarChart3 },
    { id: 'admin' as Page, label: t('nav_admin'), icon: Shield },
    { id: 'swagger' as Page, label: 'API Docs', icon: Code2 },
  ];

  const navItems = isAdmin ? allNavItems : allNavItems.filter(item => canView(item.id));
  const bottomNavItems = navItems.filter(item => ['dashboard', 'invoices', 'clients', 'products'].includes(item.id));

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex flex-col h-full bg-slate-900 dark:bg-slate-950 text-white ${mobile ? 'w-72' : collapsed ? 'w-16' : 'w-64'} transition-all duration-300`}>
      {/* App brand */}
      <div className={`flex items-center ${collapsed && !mobile ? 'justify-center px-2' : 'px-4'} py-4 border-b border-slate-700 dark:border-slate-800`}>
        {(!collapsed || mobile) && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center shrink-0">
              <FileText size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">{t('app_name')}</h1>
              <p className="text-xs text-slate-400">{t('app_subtitle')}</p>
            </div>
          </div>
        )}
        {collapsed && !mobile && (
          <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
            <FileText size={16} className="text-white" />
          </div>
        )}
      </div>

      {/* Company switcher */}
      {(!collapsed || mobile) && (
        <div className="px-3 py-2 border-b border-slate-700 dark:border-slate-800 relative">
          <button
            onClick={() => setCompanyMenuOpen(o => !o)}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-800 transition-colors text-left"
          >
            {currentCompany?.logo_url ? (
              <img src={currentCompany.logo_url} alt={currentCompany.name}
                className="w-7 h-7 rounded-md object-cover shrink-0 border border-slate-600" />
            ) : (
              <div className="w-7 h-7 bg-sky-600/30 border border-sky-600/40 rounded-md flex items-center justify-center shrink-0">
                <Building2 size={13} className="text-sky-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{currentCompany?.name ?? '—'}</p>
              <p className="text-[10px] text-slate-400 truncate">{currentCompany?.rnc ? `RNC: ${currentCompany.rnc}` : t('nav_admin')}</p>
            </div>
            <ChevronDown size={13} className={`text-slate-400 shrink-0 transition-transform ${companyMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {companyMenuOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="py-1 max-h-52 overflow-y-auto">
                {companies.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setCurrentCompany(c); setCompanyMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-700 transition-colors text-left"
                  >
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.name}
                        className="w-6 h-6 rounded-md object-cover shrink-0 border border-slate-600" />
                    ) : (
                      <div className="w-6 h-6 bg-slate-700 rounded-md flex items-center justify-center shrink-0">
                        <Building2 size={11} className="text-slate-300" />
                      </div>
                    )}
                    <span className="flex-1 truncate text-slate-200">{c.name}</span>
                    {currentCompany?.id === c.id && <Check size={11} className="text-sky-400 shrink-0" />}
                  </button>
                ))}
              </div>
              <div className="border-t border-slate-700">
                <button
                  onClick={() => { onNavigate('admin'); setCompanyMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-sky-400 hover:bg-slate-700 transition-colors"
                >
                  <Plus size={11} />
                  <span>{t('new_company') as string}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {collapsed && !mobile && (
        <div className="flex justify-center py-2 border-b border-slate-700 dark:border-slate-800">
          {currentCompany?.logo_url ? (
            <img src={currentCompany.logo_url} alt={currentCompany.name}
              className="w-8 h-8 rounded-md object-cover border border-slate-600" />
          ) : (
            <div className="w-8 h-8 bg-sky-600/30 border border-sky-600/40 rounded-md flex items-center justify-center">
              <Building2 size={13} className="text-sky-400" />
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = currentPage === id;
          const isNotif = id === 'notifications';
          return (
            <button
              key={id}
              onClick={() => { onNavigate(id); setMobileOpen(false); setCompanyMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-150 relative
                ${active
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }
                ${collapsed && !mobile ? 'justify-center px-2' : ''}
              `}
            >
              <span className="relative shrink-0">
                <Icon size={18} />
                {isNotif && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              {(!collapsed || mobile) && <span className="truncate">{label}</span>}
            </button>
          );
        })}
      </nav>

      {(!collapsed || mobile) && (
        <div className="px-4 py-4 border-t border-slate-700 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center shrink-0">
              <Shield size={14} className="text-slate-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.name ?? 'Usuario'}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email ?? ''}</p>
            </div>
            <button onClick={() => logout()} title={t('nav_logout')}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors shrink-0">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden" onClick={() => { setCompanyMenuOpen(false); setLangMenuOpen(false); }}>
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col relative" onClick={e => e.stopPropagation()}>
        <Sidebar />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-24 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 z-10 text-slate-600 dark:text-slate-300"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {navItems.find(n => n.id === currentPage)?.label}
              </h2>
              {currentCompany && (
                <p className="text-xs text-slate-400 dark:text-slate-500 hidden md:block">{currentCompany.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {/* Language selector */}
            <div className="relative" ref={langMenuRef}>
              <button
                onClick={() => setLangMenuOpen(o => !o)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors text-xs font-medium"
                title="Idioma / Language"
              >
                <Globe size={15} />
                <span className="hidden sm:inline">{LANG_LABELS[lang] ?? 'ES'}</span>
              </button>
              {langMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                  {Object.entries(LANG_NAMES).map(([code, name]) => (
                    <button
                      key={code}
                      onClick={() => handleLangChange(code)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
                    >
                      <span>{name}</span>
                      {lang === code && <Check size={11} className="text-sky-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Theme toggle */}
            <button
              onClick={handleThemeToggle}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
              title={theme === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Notifications */}
            <button
              onClick={() => onNavigate('notifications')}
              className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Settings */}
            <button onClick={() => onNavigate('admin')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 safe-bottom"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-stretch">
          {bottomNavItems.map(({ id, label, icon: Icon }) => {
            const active = currentPage === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors ${active ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'}`}
              >
                <Icon size={20} />
                <span className="w-full text-center text-[10px] font-medium truncate px-1">{label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMobileOpen(true)}
            className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-slate-500 dark:text-slate-400"
          >
            <MoreHorizontal size={20} />
            <span className="text-[10px] font-medium">{t('nav_more') as string}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
