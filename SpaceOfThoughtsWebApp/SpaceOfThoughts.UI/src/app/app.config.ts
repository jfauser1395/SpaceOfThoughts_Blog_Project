import {
  ApplicationConfig,
  importProvidersFrom,
  inject,
  isDevMode,
  provideAppInitializer,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { routes } from './app.routes';
import { provideMarkdown } from 'ngx-markdown';
import { authInterceptor } from './features/auth/interceptors/auth.interceptor';
import { provideServiceWorker } from '@angular/service-worker';
import { ThemeService } from './core/theme/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ), // Start every route at the top without preloading lazy page bundles
    importProvidersFrom(), // Import additional providers
    provideMarkdown(), // Provide Markdown support
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAppInitializer(() => inject(ThemeService).initialize()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(), // Enable service worker only in production mode
      registrationStrategy: 'registerWhenStable:30000', // Register service worker after 30 seconds of stability
    }),
  ],
};
