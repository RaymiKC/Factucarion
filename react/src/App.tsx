import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { I18nProvider, useI18n } from './lib/i18n';
import { CompanyProvider, useCompany } from './lib/company';
import { PermissionsProvider, usePermissions } from './lib/permissions';
import { ThemeProvider, useTheme } from './lib/theme';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Invoices from './pages/Invoices';
import Products from './pages/Products';
import Payments from './pages/Payments';
import Electronic from './pages/Electronic';
import EmailSchedules from './pages/EmailSchedules';
import Notifications from './pages/Notifications';
import Admin from './pages/Admin';
import Analytics from './pages/Analytics';
import Swagger from './pages/Swagger';
import MonthlyReport from './pages/MonthlyReport';

type Page = 'dashboard' | 'clients' | 'invoices' | 'products' | 'notifications' | 'email' | 'electronic' | 'admin' | 'payments' | 'analytics' | 'swagger' | 'report';

function AppInner() {
  const { isAuthenticated, user, isAdmin } = useAuth();
  const { currentCompany, loading: companyLoading } = useCompany();
  const { canView, visiblePages } = usePermissions();
  const { setTheme } = useTheme();
  const { setLang, setRegion } = useI18n();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  // Sync user preferences into theme + i18n when user loads
  useEffect(() => {
    if (!user) return;
    setTheme(user.preferredTheme);
    setLang(user.preferredLanguage as 'es' | 'en' | 'fr');
    setRegion(user.preferredRegion as 'DO' | 'US' | 'CA');
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAuthenticated) return <Login />;
  if (companyLoading) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const companyId = currentCompany?.id;

  const navigate = (page: string) => {
    const p = page as Page;
    if (!canView(p) && !isAdmin) {
      const first = visiblePages[0] as Page | undefined;
      if (first) setCurrentPage(first);
    } else {
      setCurrentPage(p);
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={navigate}>
      {currentPage === 'dashboard'     && (isAdmin || canView('dashboard'))     && <Dashboard onNavigate={navigate} companyId={companyId} />}
      {currentPage === 'clients'       && (isAdmin || canView('clients'))       && <Clients companyId={companyId} />}
      {currentPage === 'invoices'      && (isAdmin || canView('invoices'))      && <Invoices companyId={companyId} />}
      {currentPage === 'products'      && (isAdmin || canView('products'))      && <Products companyId={companyId} />}
      {currentPage === 'payments'      && (isAdmin || canView('payments'))      && <Payments companyId={companyId} />}
      {currentPage === 'electronic'    && (isAdmin || canView('electronic'))    && <Electronic companyId={companyId} />}
      {currentPage === 'email'         && (isAdmin || canView('email'))         && <EmailSchedules companyId={companyId} />}
      {currentPage === 'notifications' && (isAdmin || canView('notifications')) && <Notifications />}
      {currentPage === 'admin'         && (isAdmin || canView('admin'))         && <Admin companyId={companyId} />}
      {currentPage === 'analytics'     && (isAdmin || canView('analytics'))     && <Analytics companyId={isAdmin ? undefined : companyId} isAdmin={isAdmin} />}
      {currentPage === 'swagger'        && isAdmin                                && <Swagger />}
      {currentPage === 'report'         && (isAdmin || canView('analytics'))      && <MonthlyReport companyId={isAdmin ? undefined : companyId} />}
    </Layout>
  );
}

function CompanyBridge({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return (
    <CompanyProvider
      userRole={user?.role}
      assignedCompanyIds={user?.assignedCompanyIds ?? []}
    >
      {children}
    </CompanyProvider>
  );
}

function PermissionsBridge({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();
  return (
    <PermissionsProvider userRole={user?.role} isAdmin={isAdmin} userId={user?.id}>
      {children}
    </PermissionsProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <CompanyBridge>
            <PermissionsBridge>
              <AppInner />
            </PermissionsBridge>
          </CompanyBridge>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
