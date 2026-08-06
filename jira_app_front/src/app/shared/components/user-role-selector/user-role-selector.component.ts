import { Component, Output, EventEmitter, HostListener, signal, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface RoleSelectableUser {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  roleInProject?: string;
  role?: string;
}

@Component({
  selector: 'app-user-role-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-role-selector.component.html',
  styles: ``,
})
export class UserRoleSelectorComponent {
  /**
   * Liste complète des utilisateurs candidats.
   * Le composant filtre par `role` si les objets portent une info de rôle
   * (roleInProject ou role). Le parent est responsable de fournir la bonne
   * source (endpoint dédié ou membres du projet déjà filtrés).
   */
  readonly users = input<RoleSelectableUser[]>([]);

  /** Rôle à conserver lors du filtrage (ex: 'ScrumMaster', 'Senior', 'Developer'). */
  readonly role = input('');

  /** Sélection multiple (chips + cases) ou unique (clique → fermeture). */
  readonly multiple = input(false);

  /** IDs actuellement sélectionnés (composant contrôlé par le parent). */
  readonly selectedUsers = input<number[]>([]);

  /** Placeholder du bouton déclencheur quand rien n'est sélectionné. */
  readonly placeholder = input('Rechercher un utilisateur…');

  /** Libellé utilisé dans le placeholder de la recherche (ex: "Developer"). */
  readonly roleLabel = input('utilisateur');

  /** Désactive l'interaction (affichage en lecture seule). */
  readonly disabled = input(false);

  /** Émet la nouvelle liste d'IDs sélectionnés à chaque changement. */
  @Output() selectionChange = new EventEmitter<number[]>();

  readonly search = signal('');
  readonly isOpen = signal(false);

  private roleFiltered(): RoleSelectableUser[] {
    const r = this.role();
    if (!r) return this.users();
    // Si aucun utilisateur ne porte d'information de rôle, la liste est déjà
    // filtrée côté backend (endpoints dédiés available-*) → on la garde telle quelle.
    const all = this.users();
    if (!all.some((u) => u.roleInProject || u.role)) {
      return all;
    }
    // Sinon on filtre strictement sur le rôle attendu.
    return all.filter((u) => {
      const userRole = u.roleInProject || u.role || '';
      return userRole === r;
    });
  }

  readonly filteredUsers = computed(() => {
    const q = this.search().trim().toLowerCase();
    const selected = this.selectedUsers();
    return this.roleFiltered().filter((u) => {
      if (selected.includes(u.id)) return false;
      if (!q) return true;
      const fullName = `${u.prenom} ${u.nom}`.toLowerCase();
      return (
        fullName.includes(q) ||
        u.nom.toLowerCase().includes(q) ||
        u.prenom.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
  });

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  isSelected(id: number): boolean {
    return this.selectedUsers().includes(id);
  }

  toggle(user: RoleSelectableUser): void {
    if (this.disabled()) return;
    const current = [...this.selectedUsers()];
    if (this.multiple()) {
      const idx = current.indexOf(user.id);
      if (idx >= 0) {
        current.splice(idx, 1);
      } else {
        current.push(user.id);
      }
      this.selectionChange.emit(current);
    } else {
      const next = current.includes(user.id) ? [] : [user.id];
      this.selectionChange.emit(next);
      this.isOpen.set(false);
    }
  }

  remove(id: number): void {
    if (this.disabled()) return;
    this.selectionChange.emit(this.selectedUsers().filter((sid) => sid !== id));
  }

  getSelectedUsers(): RoleSelectableUser[] {
    return this.roleFiltered().filter((u) => this.selectedUsers().includes(u.id));
  }

  toggleOpen(): void {
    if (this.disabled()) return;
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      this.search.set('');
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-role-selector')) {
      this.isOpen.set(false);
    }
  }
}

