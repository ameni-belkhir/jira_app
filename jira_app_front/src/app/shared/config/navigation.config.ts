/**
 * Configuration centralisée du menu latéral (Sidebar).
 *
 * Source unique de vérité : chaque page, sa route, son icône et les rôles
 * autorisés par défaut. Le filtrage final est ensuite appliqué par
 * `RolePagePermissionService` (configuration frontend par rôle, stockée dans
 * localStorage) de sorte que le Sidebar et les guards utilisent la même source.
 */

export type RoleKey = 'Admin' | 'ScrumMaster' | 'Senior' | 'Developer';

export interface NavItem {
  /** Clé unique de la page / permission (ex: 'chat'). */
  key: string;
  /** Libellé affiché dans le Sidebar. */
  label: string;
  /** Route Angular (vide pour les items dynamiques comme le Backlog). */
  route: string;
  /** SVG inline de l'icône. */
  icon: string;
  /** Rôles autorisés par défaut (écrasés par la config frontend par rôle). */
  roles: RoleKey[];
  /** Hérité de l'ancien système : visible uniquement pour Admin. */
  adminOnly?: boolean;
  /** Item dynamique (ex: Backlog, nécessite un projet actif). */
  dynamic?: boolean;
}

/** Normalise la casse / les variantes d'un rôle backend. */
export function normalizeRole(role: string | null | undefined): string {
  if (!role) return '';
  const trimmed = role.trim();
  const lower = trimmed.toLowerCase().replace(/[\s_-]/g, '');
  if (lower === 'admin') return 'Admin';
  if (lower === 'scrummaster') return 'ScrumMaster';
  if (lower === 'senior') return 'Senior';
  if (lower === 'developer') return 'Developer';
  return trimmed;
}

export const ROLE_KEYS: RoleKey[] = ['Admin', 'ScrumMaster', 'Senior', 'Developer'];

const ICONS = {
  dashboard: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.5 3.25C4.25736 3.25 3.25 4.25736 3.25 5.5V8.99998C3.25 10.2426 4.25736 11.25 5.5 11.25H9C10.2426 11.25 11.25 10.2426 11.25 8.99998V5.5C11.25 4.25736 10.2426 3.25 9 3.25H5.5ZM4.75 5.5C4.75 5.08579 5.08579 4.75 5.5 4.75H9C9.41421 4.75 9.75 5.08579 9.75 5.5V8.99998C9.75 9.41419 9.41421 9.74998 9 9.74998H5.5C5.08579 9.74998 4.75 9.41419 4.75 8.99998V5.5ZM5.5 12.75C4.25736 12.75 3.25 13.7574 3.25 15V18.5C3.25 19.7426 4.25736 20.75 5.5 20.75H9C10.2426 20.75 11.25 19.7427 11.25 18.5V15C11.25 13.7574 10.2426 12.75 9 12.75H5.5ZM4.75 15C4.75 14.5858 5.08579 14.25 5.5 14.25H9C9.41421 14.25 9.75 14.5858 9.75 15V18.5C9.75 18.9142 9.41421 19.25 9 19.25H5.5C5.08579 19.25 4.75 18.9142 4.75 18.5V15ZM12.75 5.5C12.75 4.25736 13.7574 3.25 15 3.25H18.5C19.7426 3.25 20.75 4.25736 20.75 5.5V8.99998C20.75 10.2426 19.7426 11.25 18.5 11.25H15C13.7574 11.25 12.75 10.2426 12.75 8.99998V5.5ZM15 4.75C14.5858 4.75 14.25 5.08579 14.25 5.5V8.99998C14.25 9.41419 14.5858 9.74998 15 9.74998H18.5C18.9142 9.74998 19.25 9.41419 19.25 8.99998V5.5C19.25 5.08579 18.9142 4.75 18.5 4.75H15ZM15 12.75C13.7574 12.75 12.75 13.7574 12.75 15V18.5C12.75 19.7426 13.7574 20.75 15 20.75H18.5C19.7426 20.75 20.75 19.7427 20.75 18.5V15C20.75 13.7574 19.7426 12.75 18.5 12.75H15ZM14.25 15C14.25 14.5858 14.5858 14.25 15 14.25H18.5C18.9142 14.25 19.25 14.5858 19.25 15V18.5C19.25 18.9142 18.9142 19.25 18.5 19.25H15C14.5858 19.25 14.25 18.9142 14.25 18.5V15Z" fill="currentColor"></path></svg>`,
  projects: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M5 2C3.34315 2 2 3.34315 2 5V19C2 20.6569 3.34315 22 5 22H19C20.6569 22 22 20.6569 22 19V5C22 3.34315 20.6569 2 19 2H5ZM4 5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V19C20 19.5523 19.5523 20 19 20H5C4.44772 20 4 19.5523 4 19V5ZM7 7C6.44772 7 6 7.44772 6 8V9C6 9.55228 6.44772 10 7 10H8C8.55228 10 9 9.55228 9 9V8C9 7.44772 8.55228 7 8 7H7ZM7 11C6.44772 11 6 11.4477 6 12V13C6 13.5523 6.44772 14 7 14H8C8.55228 14 9 13.5523 9 13V12C9 11.4477 8.55228 11 8 11H7ZM6 16C6 15.4477 6.44772 15 7 15H8C8.55228 15 9 15.4477 9 16V17C9 17.5523 8.55228 18 8 18H7C6.44772 18 6 17.5523 6 17V16ZM11 7C10.4477 7 10 7.44772 10 8V9C10 9.55228 10.4477 10 11 10H17C17.5523 10 18 9.55228 18 9V8C18 7.44772 17.5523 7 17 7H11ZM10 12C10 11.4477 10.4477 11 11 11H17C17.5523 11 18 11.4477 18 12V13C18 13.5523 17.5523 14 17 14H11C10.4477 14 10 13.5523 10 13V12ZM11 15C10.4477 15 10 15.4477 10 16V17C10 17.5523 10.4477 18 11 18H17C17.5523 18 18 17.5523 18 17V16C18 15.4477 17.5523 15 17 15H11Z" fill="currentColor"/></svg>`,
  backlog: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 4a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H6zm1 3a1 1 0 000 2h10a1 1 0 100-2H7zm0 4a1 1 0 000 2h10a1 1 0 100-2H7zm0 4a1 1 0 000 2h6a1 1 0 100-2H7z" fill="currentColor"/></svg>`,
  chat: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M4 3h16a2 2 0 012 2v10a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2zm0 2v10h6v2l3-2h7V5H4z" fill="currentColor"/></svg>`,
  statistics: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M4 4a1 1 0 00-1 1v15h17a1 1 0 100-2H5v-1h14a1 1 0 001-1V5a1 1 0 00-1-1H4zm2 4a1 1 0 011-1h1a1 1 0 011 1v6H6V8zm4-2a1 1 0 011-1h1a1 1 0 011 1v8h-3V6zm4 2a1 1 0 011-1h1a1 1 0 011 1v6h-3V8z" fill="currentColor"/></svg>`,
  profile: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 3.5C7.30558 3.5 3.5 7.30558 3.5 12C3.5 14.1526 4.3002 16.1184 5.61936 17.616C6.17279 15.3096 8.24852 13.5955 10.7246 13.5955H13.2746C15.7509 13.5955 17.8268 15.31 18.38 17.6167C19.6996 16.119 20.5 14.153 20.5 12C20.5 7.30558 16.6944 3.5 12 3.5ZM17.0246 18.8566V18.8455C17.0246 16.7744 15.3457 15.0955 13.2746 15.0955H10.7246C8.65354 15.0955 6.97461 16.7744 6.97461 18.8455V18.856C8.38223 19.8895 10.1198 20.5 12 20.5C13.8798 20.5 15.6171 19.8898 17.0246 18.8566ZM2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12ZM11.9991 7.25C10.8847 7.25 9.98126 8.15342 9.98126 9.26784C9.98126 10.3823 10.8847 11.2857 11.9991 11.2857C13.1135 11.2857 14.0169 10.3823 14.0169 9.26784C14.0169 8.15342 13.1135 7.25 11.9991 7.25ZM8.48126 9.26784C8.48126 7.32499 10.0563 5.75 11.9991 5.75C13.9419 5.75 15.5169 7.32499 15.5169 9.26784C15.5169 11.2107 13.9419 12.7857 11.9991 12.7857C10.0563 12.7857 8.48126 11.2107 8.48126 9.26784Z" fill="currentColor"></path></svg>`,
  adminUsers: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 2a8 8 0 100 16 8 8 0 000-16zm3.25 10.25a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0zM12 7.75c-1.24 0-2.25 1.01-2.25 2.25v.25a.75.75 0 001.5 0V10a.75.75 0 011.5 0v.25a.75.75 0 001.5 0V10c0-1.24-1.01-2.25-2.25-2.25z" fill="currentColor"/></svg>`,
  adminStatistics: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M3 2a1 1 0 00-1 1v18a1 1 0 001 1h18a1 1 0 001-1V3a1 1 0 00-1-1H3zm1 18V4h16v16H4zm3-7a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H8a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1h-2a1 1 0 01-1-1V9z" fill="currentColor"/></svg>`,
};

/**
 * Liste complète des pages du menu.
 * - `backlog` est dynamique : sa route est construite avec l'ID du projet actif.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    route: '/dashboard',
    icon: ICONS.dashboard,
    roles: ['Admin', 'ScrumMaster', 'Senior', 'Developer'],
  },
  {
    key: 'projects',
    label: 'Projects',
    route: '/projects',
    icon: ICONS.projects,
    roles: ['Admin', 'ScrumMaster', 'Senior', 'Developer'],
  },
  {
    key: 'backlog',
    label: 'Backlog',
    route: '',
    icon: ICONS.backlog,
    roles: ['Admin', 'ScrumMaster', 'Senior', 'Developer'],
    dynamic: true,
  },
  {
    key: 'chat',
    label: 'Messages',
    route: '/chat',
    icon: ICONS.chat,
    roles: ['Admin', 'ScrumMaster', 'Senior', 'Developer'],
  },
  {
    key: 'statistics',
    label: 'Statistics',
    route: '/statistics',
    icon: ICONS.statistics,
    roles: ['Admin', 'ScrumMaster'],
  },
  {
    key: 'profile',
    label: 'Profile',
    route: '/profile',
    icon: ICONS.profile,
    roles: ['Admin', 'ScrumMaster', 'Senior', 'Developer'],
  },
  {
    key: 'admin-users',
    label: 'Gestion des users',
    route: '/admin/users',
    icon: ICONS.adminUsers,
    roles: ['Admin'],
    adminOnly: true,
  },
  {
    key: 'admin-projects',
    label: 'Admin Projects',
    route: '/admin/projects',
    icon: ICONS.projects,
    roles: ['Admin'],
    adminOnly: true,
  },
  {
    key: 'admin-statistics',
    label: 'Statistiques',
    route: '/admin/statistics',
    icon: ICONS.adminStatistics,
    roles: ['Admin'],
    adminOnly: true,
  },
];

