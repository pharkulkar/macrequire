import { Routes } from '@angular/router';
import { adminGuard } from './core/admin-http';

/** Lazy-loaded admin area. Everything except sign-in requires a signed-in admin. */
export const ADMIN_ROUTES: Routes = [
  { path: 'login', title: 'Admin sign in | MacRequire', loadComponent: () => import('./login/login').then((m) => m.AdminLogin) },
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./shell/shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', title: 'Dashboard | MacRequire Admin', loadComponent: () => import('./dashboard/dashboard').then((m) => m.AdminDashboard) },
      { path: 'pricing', title: 'Pricing & offers | MacRequire Admin', loadComponent: () => import('./pricing/pricing').then((m) => m.AdminPricing) },
      { path: 'merchants', title: 'Merchants | MacRequire Admin', loadComponent: () => import('./merchants/merchants').then((m) => m.AdminMerchants) },
      { path: 'catalog', title: 'Catalog | MacRequire Admin', loadComponent: () => import('./catalog/catalog-admin').then((m) => m.AdminCatalog) },
      { path: 'applications', title: 'Applications | MacRequire Admin', loadComponent: () => import('./applications/applications-admin').then((m) => m.AdminApplications) },
      { path: 'scoring', title: 'Scoring engine | MacRequire Admin', loadComponent: () => import('./scoring/scoring').then((m) => m.AdminScoring) },
      { path: 'imports', title: 'CSV imports | MacRequire Admin', loadComponent: () => import('./imports/imports').then((m) => m.AdminImports) },
      { path: 'team', title: 'Team & audit | MacRequire Admin', loadComponent: () => import('./team/team').then((m) => m.AdminTeam) },
    ],
  },
  { path: '**', redirectTo: '' },
];
