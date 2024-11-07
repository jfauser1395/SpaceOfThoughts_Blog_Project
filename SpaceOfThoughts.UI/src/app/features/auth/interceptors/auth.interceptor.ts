import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { Observable } from 'rxjs/internal/Observable';

// Define an HTTP interceptor function
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>, // Incoming HTTP request
  next: HttpHandlerFn // Next handler in the chain
): Observable<HttpEvent<any>> => {
  // Inject CookieService to access cookies
  const cookieService = inject(CookieService);
  // Get the 'Authorization' token from cookies
  const token = cookieService.get('Authorization');

  // If the token exists, clone the request and add the authorization header
  if (token) {
    const cloned = req.clone({
      setHeaders: {
        authorization: token,
      },
    });
    // Pass the cloned request with the added header to the next handler
    return next(cloned);
  } else {
    // If no token, pass the original request to the next handler
    return next(req);
  }
};
