import { TestBed } from '@angular/core/testing';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { of } from 'rxjs';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  const interceptor: HttpInterceptorFn = (req, next) =>
    TestBed.runInInjectionContext(() => authInterceptor(req, next));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('includes credentials with a same-origin API request', () => {
    const forwardedRequest = intercept(new HttpRequest('GET', '/api/Auth/me'));

    expect(forwardedRequest.withCredentials).toBeTrue();
  });

  it('does not attach credential mode to public images', () => {
    const forwardedRequest = intercept(
      new HttpRequest('GET', '/Images/Blog/photo.jpg'),
    );

    expect(forwardedRequest.withCredentials).toBeFalse();
  });

  it('does not attach credential mode to an external request', () => {
    const forwardedRequest = intercept(
      new HttpRequest('GET', 'https://example.com/resource'),
    );

    expect(forwardedRequest.withCredentials).toBeFalse();
  });

  function intercept(request: HttpRequest<unknown>): HttpRequest<unknown> {
    let forwardedRequest: HttpRequest<unknown> | undefined;

    interceptor(request, (nextRequest) => {
      forwardedRequest = nextRequest;
      return of(new HttpResponse({ status: 204 }));
    }).subscribe();

    return forwardedRequest!;
  }
});
