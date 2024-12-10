import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { AuthService } from '../services/auth.service';
import { jwtDecode } from 'jwt-decode';

// Define a user authentication guard function
export const userAuthGuard: CanActivateFn = (route, state) => {
  // Inject necessary services
  const cookieService = inject(CookieService);
  const authService = inject(AuthService);
  const router = inject(Router);

  // Get the current user
  const user = authService.getUser();

  // Check for the JWT Token
  let token = cookieService.get('Authorization');

  if (token && user) {
    // Remove 'Bearer' prefix if present
    token = token.replace('Bearer', '');

    // Decode the token to check its expiration
    const decodedToken: any = jwtDecode(token);
    const expirationDate = decodedToken.exp * 1000; // Token expiration date in milliseconds
    const currentTime = new Date().getTime(); // Current time in milliseconds

    // Check if the token has expired
    if (expirationDate < currentTime) {
      // If expired, log out the user
      authService.logout();

      // Redirect to the login page with the return URL
      return router.createUrlTree(['/login'], {
        queryParams: { returnUrl: state.url },
      });
    } else {
      // If the token is still valid
      if (user.roles.includes('Reader') || user.roles.includes('Writer')) {
        return true; // Allow access if the user has 'Reader' or 'Writer' role
      } else {
        alert('Unauthorized'); // Alert unauthorized access
        return false; // Deny access
      }
    }
  } else {
    // If no token or user, log out and redirect to the login page
    authService.logout();
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl: state.url },
    });
  }
};
