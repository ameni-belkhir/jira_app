import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NAV_ITEMS } from '../shared/config/navigation.config';

/**
 * Guard de permission par route.
 *
 * Utilise la MÊME source de vérité que le Sidebar : les permissions réelles
 * de l'utilisateur connecté (`AuthService.hasPermission`) renvoyées par le backend.
 *
 * Usage : `canActivate: [PermissionGuard], data: { pageKey: 'chat' }`
 */
export const PermissionGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot
): boolean | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated) {
    return router.parseUrl('/login');
  }

const pageKey = route.data?.['pageKey'] as string | undefined;
  if (!pageKey) {
    return true; // pas de restriction → autorisé
  }

  if (authService.hasPermission(pageKey)) {
    return true;
  }

// Accès refusé : redirige vers la PREMIÈRE page autorisée de l'utilisateur.
  for (const item of NAV_ITEMS) {
    if (!item.adminOnly || authService.isAdmin()) {
      if (item.route && authService.hasPermission(item.key)) {
        return router.parseUrl(item.route);
      }
    }
  }

// Aucune page autorisée → page sûre (login).
  return router.parseUrl('/login');
};
