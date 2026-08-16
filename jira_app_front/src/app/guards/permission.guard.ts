import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NAV_ITEMS, NavItem } from '../shared/config/navigation.config';

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

  const navItem = NAV_ITEMS.find(item => item.key === pageKey);
  if (navItem) {
    if (hasAccess(authService, navItem)) {
      return true;
    }
  } else if (authService.hasPermission(pageKey)) {
    return true;
  }

  // Accès refusé : redirige vers la première route valide autorisée,
  // sinon vers une page sûre (dashboard).
  return resolveFallback(authService, router);
};

/**
 * Source de vérité unique d'accès à un item de navigation :
 * la permission (`hasPermission`) est obligatoire, et une page
 * `adminOnly` impose en plus le rôle Admin.
 */
function hasAccess(authService: AuthService, item: NavItem): boolean {
  if (!authService.hasPermission(item.key)) {
    return false;
  }
  if (item.adminOnly && !authService.isAdmin()) {
    return false;
  }
  return true;
}

/** Une route de repli doit être non vide et absolue (les items dynamiques sont exclus). */
function hasValidRoute(item: NavItem): boolean {
  return !!item.route && item.route.startsWith('/');
}

/** Retourne la première page autorisée de NAV_ITEMS, ou `/dashboard` par défaut. */
function resolveFallback(authService: AuthService, router: Router): UrlTree {
  const target = NAV_ITEMS.find(item => hasAccess(authService, item) && hasValidRoute(item));
  return router.parseUrl(target ? target.route : '/dashboard');
}
