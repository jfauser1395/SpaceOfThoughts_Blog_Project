import {
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

// Define an HTTP interceptor function
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>, // Incoming HTTP request
  next: HttpHandlerFn, // Next handler in the chain
): Observable<HttpEvent<any>> => {
  const apiBaseUrl = environment.apiBaseUrl.replace(/\/+$/, '');
  const isApiRequest =
    req.url === apiBaseUrl || req.url.startsWith(`${apiBaseUrl}/`);

  if (!isApiRequest) {
    return next(req);
  }

  // Allow the browser to send the API-owned HttpOnly authentication cookie.
  return next(req.clone({ withCredentials: true }));
};
