/**
 * Libellés standardisés des rôles globaux.
 * Source unique de vérité : même affichage partout dans l'app
 * (ex: badge rôle du profil, back-office Admin, etc.).
 */

/** Identifiants backend des rôles globaux (alignés sur la table Roles). */
export const ROLE_LABELS_BY_ID: Record<number, string> = {
  1: 'Admin',
  2: 'ScrumMaster',
  3: 'Senior',
  4: 'Developer',
};

/** Libellé d'affichage d'une clé de rôle normalisée (ex: 'ScrumMaster'). */
const ROLE_KEY_LABELS: Record<string, string> = {
  Admin: 'Admin',
  ScrumMaster: 'ScrumMaster',
  Senior: 'Senior',
  Developer: 'Developer',
};

/** Libellé d'un rôle global depuis son identifiant backend ('' si inconnu). */
export function getRoleLabel(roleId: number): string {
  return ROLE_LABELS_BY_ID[roleId] ?? '';
}

/** Libellé d'un rôle global depuis sa clé normalisée (ex: AuthService.getRole()). */
export function getRoleKeyLabel(role: string | null | undefined): string {
  if (!role) return '';
  return ROLE_KEY_LABELS[role] ?? role;
}
