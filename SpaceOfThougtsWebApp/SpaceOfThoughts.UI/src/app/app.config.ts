import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { importProvidersFrom, isDevMode } from '@angular/core';
import { provideMarkdown } from 'ngx-markdown';
import { authInterceptor } from './features/auth/interceptors/auth.interceptor';
import { CookieService } from 'ngx-cookie-service';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes), // Provide application routes
    importProvidersFrom(), // Import additional providers
    provideMarkdown(), // Provide Markdown support
    provideHttpClient(withFetch()), // Provide HTTP client with fetch API
    provideHttpClient(withInterceptors([authInterceptor])), // Provide HTTP client with authentication interceptor
    CookieService, // Provide CookieService for handling cookies
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(), // Enable service worker only in production mode
      registrationStrategy: 'registerWhenStable:30000', // Register service worker after 30 seconds of stability
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(), // Enable service worker only in production mode
      registrationStrategy: 'registerWhenStable:30000', // Register service worker after 30 seconds of stability
    }),
  ],
};
