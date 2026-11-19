import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { environment } from '../environments/environment';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { SITE_URL } from './core/site';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // Lets one build be deployed to any domain by setting SITE_URL when the server starts.
    { provide: SITE_URL, useFactory: () => (process.env['SITE_URL'] ?? environment.siteUrl).replace(/\/$/, '') },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
