import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  isActive,
  provideRouter,
  Router,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
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
    // Forward uncaught browser errors and rejected promises to Angular's ErrorHandler
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      // Let Angular replace routed views inside the browser's native cross-fade
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition }) => {
          const router = inject(Router);
          const targetUrl = router.currentNavigation()?.finalUrl;

          if (!targetUrl) {
            return;
          }

          // Avoid animating searches or filters that only change URL parameters
          const keepsCurrentRoute = isActive(targetUrl, router, {
            paths: 'exact',
            matrixParams: 'exact',
            fragment: 'ignored',
            queryParams: 'ignored',
          });

          if (keepsCurrentRoute()) {
            transition.skipTransition();
          }
        },
      }),
    ), // Start every route at the top without preloading lazy page bundles
    provideMarkdown(), // Provide Markdown support
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAppInitializer(() => inject(ThemeService).initialize()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(), // Enable service worker only in production mode
      registrationStrategy: 'registerWhenStable:30000', // Register service worker after 30 seconds of stability
    }),
  ],
};
