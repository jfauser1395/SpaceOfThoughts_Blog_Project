import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { catchError, map, of } from 'rxjs';

// Define an authentication guard function
export const authGuard: CanActivateFn = (route, state) => {
  // Inject necessary services
  const authService = inject(AuthService);
  const router = inject(Router);

  // Ask the API to validate its HttpOnly cookie before opening a writer route.
  return authService.getCurrentProfile().pipe(
    map((user) => {
      authService.setUser(user);

      if (user.roles.includes('Writer')) {
        return true;
      }

      alert('Unauthorized');
      return false;
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
