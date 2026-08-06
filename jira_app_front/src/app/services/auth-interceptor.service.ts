import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Décodage du payload d'un JWT (partie centrale) sans validation.
 * Retourne l'objet payload JSON, ou null si le token est malformé.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(padded).split('').map((c) =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join('')
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Vérifie si le JWT est expiré en analysant le claim `exp` (timestamp Unix).
 * Retourne true si le token est expiré, invalide ou dépourvu de claim exp.
 */
function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload) return true;

  const exp = payload['exp'];
  if (typeof exp !== 'number') return true;

  const now = Math.floor(Date.now() / 1000);
  // Ajoute une marge de sécurité de 30 s pour éviter les incohérences d'horloge.
  return exp <= now + 30;
}

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

  // Auth endpoints (login, register, verify, reset) n'ont pas besoin du token.
  if (!token || isAuthEndpoint) {
    return next(req);
  }

  // Token expiré ou malformé → purge de session + redirection login.
  if (isTokenExpired(token)) {
    authService.logout();
    router.navigate(['/login'], { replaceUrl: true });
    return throwError(
      () => new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized',
        url: req.url,
        error: { message: 'Session expirée. Veuillez vous reconnecter.' }
      })
    );
  }

  const cloned = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(cloned).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Token invalidé côté serveur → clear session and redirect to login
        authService.logout();
        router.navigate(['/login'], { replaceUrl: true });
      }
      return throwError(() => error);
    })
  );
};
