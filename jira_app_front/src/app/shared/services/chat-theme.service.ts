import { Injectable, signal, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

export type ChatThemeId =
  | 'trello' | 'gradient-dark' | 'starry-night' | 'slate' | 'gradient-light'
  | 'coral-sunset' | 'ocean-breeze' | 'lavender-dreams' | 'mint-fresh' | 'aurora';

export interface ChatThemeOption {
  id: ChatThemeId;
  label: string;
  /** Aperçu CSS injecté dans la puce du sélecteur. */
  swatch: string;
}

export const CHAT_THEMES: ChatThemeOption[] = [
  {
    id: 'trello',
    label: 'Arrière-plan Trello',
    swatch: 'background-color:#0079bf;background-image:radial-gradient(circle at 25% 25%,rgba(255,255,255,0.08) 0 2px,transparent 3px);background-size:22px 22px',
  },
  {
    id: 'gradient-dark',
    label: 'Dégradé Sombre',
    swatch: 'background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 55%,#0f172a 100%)',
  },
  {
    id: 'starry-night',
    label: 'Nuit Étoilée',
    swatch: 'background-color:#0b1020;background-image:radial-gradient(1px 1px at 30% 30%,rgba(255,255,255,0.9) 0,transparent 100%),radial-gradient(1px 1px at 70% 60%,rgba(255,255,255,0.7) 0,transparent 100%),radial-gradient(1.5px 1.5px at 50% 20%,rgba(255,255,255,0.8) 0,transparent 100%)',
  },
  {
    id: 'slate',
    label: 'Minimaliste Slate',
    swatch: 'background-color:#e2e8f0',
  },
  {
    id: 'gradient-light',
    label: 'Dégradé Clair',
    swatch: 'background:linear-gradient(135deg,#fef3c7 0%,#fde68a 50%,#fca5a5 100%)',
  },
  {
    id: 'coral-sunset',
    label: 'Coucher de Soleil',
    swatch: 'background:linear-gradient(135deg,#fca5a5 0%,#fb923c 50%,#fbbf24 100%)',
  },
  {
    id: 'ocean-breeze',
    label: 'Brise Marine',
    swatch: 'background:linear-gradient(135deg,#67e8f9 0%,#22d3ee 50%,#06b6d4 100%)',
  },
  {
    id: 'lavender-dreams',
    label: 'Rêves de Lavande',
    swatch: 'background:linear-gradient(135deg,#c4b5fd 0%,#a78bfa 50%,#f0abfc 100%)',
  },
  {
    id: 'mint-fresh',
    label: 'Menthe Fraîche',
    swatch: 'background:linear-gradient(135deg,#6ee7b7 0%,#34d399 50%,#a7f3d0 100%)',
  },
  {
    id: 'aurora',
    label: 'Aurore Boréale',
    swatch: 'background:linear-gradient(135deg,#60a5fa 0%,#34d399 50%,#a78bfa 100%)',
  },
];

/**
 * Gestionnaire de thème du fond de discussion.
 * La préférence est stockée dans le localStorage, par utilisateur (clé `chat-theme-<userId>`),
 * en s'appuyant sur le thème global de l'application (mode clair/sombre).
 */
@Injectable({ providedIn: 'root' })
export class ChatThemeService {
  private readonly STORAGE_PREFIX = 'chat-theme';

  /** AuthService fournit l'identifiant de l'utilisateur connecté (sessionStorage). */
  private authService = inject(AuthService);

  /** Thème de fond actif de la zone de discussion. */
  readonly currentTheme = signal<ChatThemeId>(this.load());

  private storageKey(): string {
    const userId = this.authService.getUserId();
    return userId ? `${this.STORAGE_PREFIX}-${userId}` : this.STORAGE_PREFIX;
  }

  private load(): ChatThemeId {
    const stored = localStorage.getItem(this.storageKey()) as ChatThemeId | null;
    return stored && CHAT_THEMES.some((t) => t.id === stored) ? stored : 'trello';
  }

  getTheme(): ChatThemeId {
    return this.currentTheme();
  }

  setTheme(theme: ChatThemeId): void {
    if (!CHAT_THEMES.some((t) => t.id === theme)) return;
    localStorage.setItem(this.storageKey(), theme);
    this.currentTheme.set(theme);
  }
}
