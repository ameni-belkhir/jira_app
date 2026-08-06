import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NAV_ITEMS, NavItem, RoleKey, normalizeRole } from '../config/navigation.config';
import { AuthService } from '../../services/auth.service';

/**
 * Service centralisé de configuration des pages par rôle (côté frontend).
 *
 * Source unique de vérité pour le Sidebar et les guards :
 * - La configuration des pages autorisées par rôle est stockée dans `localStorage`
 *   (clé `rolePagePermissions`), donc persistée après refresh / login.
 * - Chaque page est identifiée par sa `key` (ex: 'chat', 'statistics').
 * - Le rôle de l'utilisateur connecté provient de `AuthService.getRole()`.
 *
 * Règles appliquées :
 * - Si aucune configuration n'existe pour un rôle, on utilise les rôles par défaut
 *   définis dans `NAV_ITEMS` (champ `roles`).
 * - Une page `adminOnly` n'est visible que si le rôle est `Admin`.
 * - Les pages marquées `dynamic` (ex: Backlog) sont gérées séparément par le Sidebar.
 */
@Injectable({ providedIn: 'root' })
export class RolePagePermissionService {
private readonly STORAGE_KEY = 'rolePagePermissions';

  private authService = inject(AuthService);

  /** Signal de modification de la configuration par rôle (réactivité Sidebar). */
  private changesSubject = new BehaviorSubject<boolean>(true);

  /** Observable émis à chaque sauvegarde de configuration par rôle. */
  get changes$(): Observable<boolean> {
    return this.changesSubject.asObservable();
  }

/**
   * Récupère les clés de pages configurées pour un rôle.
   *
   * RÈGLE ESSENTIELLE :
   * - Si le rôle EXISTE réellement dans la configuration (même avec une liste vide `[]`),
   *   on retourne EXACTEMENT ses pageKeys (une liste vide = AUCUNE page autorisée).
   * - On n'utilise les pages par défaut QUE si le rôle n'a AUCUNE configuration.
   *
   * On teste la présence de la clé via `hasOwnProperty` (jamais par vérité d'un tableau),
   * car `[]` est une configuration volontaire valide.
   */
getEnabledPageKeys(role: RoleKey): string[] {
    const normalized = normalizeRole(role) as RoleKey;
    const config = this.getRawConfig();
    let result: string[];
    if (Object.prototype.hasOwnProperty.call(config, normalized)) {
      result = config[normalized];
    } else {
      // Aucune configuration pour ce rôle → pages par défaut.
      result = this.getDefaultPages(normalized);
    }
    console.log('[PERMISSIONS] Current user role:', normalized);
    console.log(
      '[PERMISSIONS] Configuration for current role:',
      Object.prototype.hasOwnProperty.call(config, normalized) ? config[normalized] : '(none → defaults)'
    );
    console.log('[PERMISSIONS] Enabled pages:', result);
    return result;
  }

/** Définit les pages autorisées pour un rôle (persisté dans localStorage). */
  setRolePageKeys(role: RoleKey, keys: string[]): void {
    const normalized = normalizeRole(role) as RoleKey;
    const config = this.getRawConfig();
    config[normalized] = keys;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    // Notifie le Sidebar (et les autres consommateurs) du changement.
    this.changesSubject.next(true);
  }

  /** Vérifie si un rôle a accès à une page donnée (par clé). */
  roleHasPage(role: RoleKey, key: string): boolean {
    const normalized = normalizeRole(role) as RoleKey;
    // Source de vérité UNIQUE : la configuration par rôle (ou les défauts si aucune config).
    return this.getEnabledPageKeys(normalized).includes(key);
  }

  /** Filtre les items du menu pour un rôle donné. */
  getMenuItemsForRole(role: RoleKey): NavItem[] {
    const normalized = normalizeRole(role) as RoleKey;
    const enabledKeys = this.getEnabledPageKeys(normalized);
    return NAV_ITEMS.filter((item) => {
      if (item.adminOnly && normalized !== 'Admin') return false;
      return enabledKeys.includes(item.key);
    });
  }

  /** Vérifie si l'utilisateur connecté a accès à une page (par clé). */
  currentUserHasPage(key: string): boolean {
    const role = this.authService.getRole();
    if (!role) return false;
    const normalized = normalizeRole(role) as RoleKey;
    return this.roleHasPage(normalized, key);
  }

  /** Vérifie si l'utilisateur connecté a accès à une route (pour les guards). */
  currentUserCanAccessRoute(route: string): boolean {
    const item = NAV_ITEMS.find((i) => i.route && (route === i.route || route.startsWith(i.route)));
    if (!item) return true; // routes inconnues → autorisé (AuthGuard gère l'authentification)
    return this.currentUserHasPage(item.key);
  }

/** Pages par défaut pour un rôle (définies dans la config centralisée NAV_ITEMS). */
  private getDefaultPages(role: RoleKey): string[] {
    return NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => item.key);
  }

/** Première page autorisée pour un rôle (utilisée pour les redirections). */
  getFirstEnabledPageKey(role: RoleKey): string {
    const keys = this.getEnabledPageKeys(role);
    if (keys.length > 0) return keys[0];
    return '';
  }

  /** Récupère un item de menu par sa clé (pour obtenir sa route). */
  getMenuItemByKey(key: string): NavItem | undefined {
    return NAV_ITEMS.find((item) => item.key === key);
  }

  private getRawConfig(): Record<string, string[]> {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}
