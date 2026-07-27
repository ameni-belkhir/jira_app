import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();
  const isAuthEndpoint = req.url.includes('/api/Auth/login')
    || req.url.includes('/api/Auth/register')
    || req.url.includes('/api/Auth/verify-code')
    || req.url.includes('/api/Auth/verify-login-code')
    || req.url.includes('/api/Auth/verify-registration-code')
    || req.url.includes('/api/Auth/forgot-password')
    || req.url.includes('/api/Auth/reset-password');

  if (token && !isAuthEndpoint) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Token expired or invalid → clear session and redirect to login
          authService.logout();
          router.navigate(['/login'], { replaceUrl: true });
        }
        return throwError(() => error);
      })
    );
  }

  return next(req);
};
