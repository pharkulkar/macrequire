import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'MacRequire | Find the MacBook That Actually Fits Your Needs',
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'find',
    title: 'Find My MacBook | MacRequire',
    loadComponent: () => import('./pages/find/find').then((m) => m.Find),
  },
  {
    path: 'results',
    title: 'Your MacBook recommendations | MacRequire',
    loadComponent: () => import('./pages/results/results').then((m) => m.Results),
  },
  {
    path: 'results/:id',
    title: 'Your MacBook recommendations | MacRequire',
    loadComponent: () => import('./pages/results/results').then((m) => m.Results),
  },
  {
    path: 'catalog',
    title: 'MacBook Catalog | MacRequire',
    loadComponent: () => import('./pages/catalog/catalog').then((m) => m.Catalog),
  },
  {
    path: 'catalog/:id',
    title: 'MacBook Details | MacRequire',
    loadComponent: () => import('./pages/product-detail/product-detail').then((m) => m.ProductDetailPage),
  },
  {
    path: 'compare',
    title: 'Compare configurations | MacRequire',
    loadComponent: () => import('./pages/compare/compare').then((m) => m.Compare),
  },
  {
    path: 'applications',
    title: 'Application Directory | MacRequire',
    loadComponent: () => import('./pages/applications/applications').then((m) => m.Applications),
  },
  { path: 'admin', loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES) },
  {
    path: 'about',
    title: 'About MacRequire | MacRequire',
    loadComponent: () => import('./pages/about/about').then((m) => m.About),
  },
  {
    path: 'affiliate-disclosure',
    title: 'Affiliate Disclosure | MacRequire',
    loadComponent: () => import('./pages/affiliate-disclosure/affiliate-disclosure').then((m) => m.AffiliateDisclosure),
  },
  {
    path: 'offer-unavailable',
    title: 'Offer unavailable | MacRequire',
    loadComponent: () => import('./pages/offer-unavailable/offer-unavailable').then((m) => m.OfferUnavailable),
  },
  {
    path: 'guides',
    pathMatch: 'full',
    title: 'MacBook buying guides | MacRequire',
    loadComponent: () => import('./pages/guides/guides-hub').then((m) => m.GuidesHub),
  },
  {
    path: 'guides/how-much-ram-for-macbook',
    title: 'How much memory (RAM) does a MacBook need? | MacRequire',
    loadComponent: () => import('./pages/guides/guide-ram').then((m) => m.GuideRam),
  },
  {
    path: 'guides/macbook-air-vs-macbook-pro',
    title: 'MacBook Air vs MacBook Pro: specifications compared | MacRequire',
    loadComponent: () => import('./pages/guides/guide-air-vs-pro').then((m) => m.GuideAirVsPro),
  },
  {
    path: 'guides/how-much-storage-for-macbook',
    title: 'How much storage does a MacBook need? | MacRequire',
    loadComponent: () => import('./pages/guides/guide-storage').then((m) => m.GuideStorage),
  },
  {
    path: 'methodology',
    title: 'How MacRequire scores MacBooks | MacRequire',
    loadComponent: () => import('./pages/methodology/methodology').then((m) => m.MethodologyPage),
  },
  {
    path: 'privacy',
    title: 'Privacy policy | MacRequire',
    loadComponent: () => import('./pages/privacy/privacy').then((m) => m.Privacy),
  },
  {
    path: 'terms',
    title: 'Terms of use | MacRequire',
    loadComponent: () => import('./pages/terms/terms').then((m) => m.Terms),
  },
  {
    path: '**',
    title: 'Page not found | MacRequire',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
