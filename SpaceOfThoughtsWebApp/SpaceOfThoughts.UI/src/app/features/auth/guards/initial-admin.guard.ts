import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Revalidate the server-owned session before loading initial-admin-only features.
export const initialAdminGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.getCurrentProfile().pipe(
    map((user) => {
      authService.setUser(user);

      return user.roles.includes('InitialAdmin')
        ? true
        : router.createUrlTree(['/'], {
            queryParams: { unauthorized: state.url },
          });
    }),
    catchError(() => {
      authService.clearLocalSession();
      return of(
        router.createUrlTree(['/login'], {
          queryParams: { returnUrl: state.url },
        }),
      );
    }),
  );
};
