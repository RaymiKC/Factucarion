import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  { path: 'dashboard', canActivate: [authGuard], loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'invoices', canActivate: [authGuard], loadComponent: () => import('./pages/invoices/invoices.component').then(m => m.InvoicesComponent) },
  { path: 'clients', canActivate: [authGuard], loadComponent: () => import('./pages/clients/clients.component').then(m => m.ClientsComponent) },
  { path: 'products', canActivate: [authGuard], loadComponent: () => import('./pages/products/products.component').then(m => m.ProductsComponent) },
  { path: 'payments', canActivate: [authGuard], loadComponent: () => import('./pages/payments/payments.component').then(m => m.PaymentsComponent) },
  { path: 'electronic', canActivate: [authGuard], loadComponent: () => import('./pages/electronic/electronic.component').then(m => m.ElectronicComponent) },
  { path: 'email_schedules', canActivate: [authGuard], loadComponent: () => import('./pages/email-schedules/email-schedules.component').then(m => m.EmailSchedulesComponent) },
  { path: 'notifications', canActivate: [authGuard], loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent) },
  { path: 'analytics', canActivate: [authGuard], loadComponent: () => import('./pages/analytics/analytics.component').then(m => m.AnalyticsComponent) },
  { path: 'monthly_report', canActivate: [authGuard], loadComponent: () => import('./pages/monthly-report/monthly-report.component').then(m => m.MonthlyReportComponent) },
  { path: 'swagger', canActivate: [authGuard], loadComponent: () => import('./pages/swagger/swagger.component').then(m => m.SwaggerComponent) },
  { path: 'admin', canActivate: [authGuard], loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent) },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];
