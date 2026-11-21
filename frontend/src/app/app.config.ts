import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withNavigationErrorHandler } from '@angular/router';
import { Connection } from './core/connection.service';
import { adminInterceptor } from './admin/core/admin-http';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      // A page whose code cannot be downloaded (usually a lost connection) would otherwise fail without a word.
      withNavigationErrorHandler(() => inject(Connection).reportPageError()),
    ),
    provideHttpClient(withFetch(), withInterceptors([adminInterceptor])),
    provideClientHydration(),
  ],
};
