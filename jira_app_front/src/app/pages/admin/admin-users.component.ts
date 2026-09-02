import { Component, OnInit, signal, computed, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';
import { AdminService, AdminUser, CreateUserResponse, UserPermission, Role, RoleChangeImpactItem, ProjectRoleDecision } from '../../services/admin.service';
import { getRoleLabel as sharedGetRoleLabel } from '../../shared/utils/role.utils';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.component.html',
  styles: ``,
})
export class AdminUsersComponent implements OnInit {
  private adminService = inject(AdminService);
  private notification = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  users = signal<AdminUser[]>([]);
  loading = signal(false);
  error = signal('');

  // Search & filter state
  searchTerm = signal<string>('');
  selectedRoleFilter = signal<string>('');

  /** Users filtered in real time by search term and role filter */
  filteredUsers = computed<AdminUser[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const role = this.selectedRoleFilter();
    return this.users().filter((user) => {
      const matchesTerm =
        !term ||
        user.nom.toLowerCase().includes(term) ||
        user.prenom.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term);
      const matchesRole = !role || user.role === role;
      return matchesTerm && matchesRole;
    });
  });

  // Create modal state
  showCreateModal = signal(false);
  createForm = {
    nom: '',
    prenom: '',
    email: '',
    roleId: 4, // default: Developer
  };
  creating = signal(false);
  createError = '';

  // Edit modal state
  showEditModal = signal(false);
  selectedUser = signal<AdminUser | null>(null);
  selectedRoleId = signal<number>(0);
  permissions = signal<UserPermission[]>([]);
  saving = signal(false);
  modalError = '';

  // Role change impact confirmation modal state
  showRoleChangeModal = signal(false);
  roleChangeImpact = signal<RoleChangeImpactItem[]>([]);
  roleChangeNewRoleLabel = signal('');
  /** alignToNewRole par projet (projectId → booléen) */
  roleChangeAlign = signal<Record<number, boolean>>({});

  // Static role list (IDs correspond to backend roles)
  readonly roles: Role[] = [
    { id: 1, description: 'Admin' },
    { id: 2, description: 'ScrumMaster' },
    { id: 3, description: 'Senior' },
    { id: 4, description: 'Developer' },
  ];

  /** Maps backend interfaceKey → French label */
  private readonly INTERFACE_LABELS: Record<string, string> = {
    dashboard: 'Tableau de bord',
    projects: 'Projets',
    statistics: 'Statistiques',
    chat: 'Messagerie',
    backlog: 'Backlog produit',
    kanban: 'Tableau Kanban',
    users: 'Gestion des utilisateurs',
    roles: 'Gestion des rôles',
  };

/** Returns a human-readable label for a permission interfaceKey */
  getPermissionLabel(interfaceKey: string): string {
    return this.INTERFACE_LABELS[interfaceKey] || interfaceKey;
  }

  /** Returns the initials (first letter of first name + first letter of last name) */
  getInitials(user: AdminUser): string {
    const first = (user.prenom || '').charAt(0);
    const last = (user.nom || '').charAt(0);
    return `${first}${last}`.toUpperCase();
  }

  /** Returns a color class for the avatar, stable per user */
  getAvatarColor(user: AdminUser): string {
    const palette = [
      'bg-brand-500',
      'bg-purple-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-teal-500',
    ];
    return palette[(user.id ?? 0) % palette.length];
  }

  /** Returns the badge classes matching the user role */
  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'Admin':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400';
      case 'ScrumMaster':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400';
      case 'Senior':
        return 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400';
      case 'Developer':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400';
    }
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.error.set('');
    this.notification.loading('Chargement des utilisateurs…');

    this.adminService.getUsers()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loading.set(false);
          this.notification.dismiss();
        })
      )
      .subscribe({
        next: (data) => {
          this.users.set(data);
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 0
            ? 'Impossible de se connecter au serveur.'
            : err.status === 500
              ? 'Serveur indisponible.'
              : 'Échec du chargement des utilisateurs.';
          this.error.set(msg);
          this.notification.error(msg);
        }
      });
  }

  openCreateModal(): void {
    this.createForm = { nom: '', prenom: '', email: '', roleId: 4 };
    this.createError = '';
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.createError = '';
  }

  onCreateUser(): void {
    // Basic validation
    if (!this.createForm.nom.trim() || !this.createForm.prenom.trim() || !this.createForm.email.trim()) {
      this.createError = 'Tous les champs sont requis.';
      this.notification.error(this.createError);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.createForm.email.trim())) {
      this.createError = 'L\'email n\'est pas valide.';
      this.notification.error(this.createError);
      return;
    }

    this.creating.set(true);
    this.createError = '';
    this.notification.loading('Création de l\'utilisateur…');

    this.adminService.createUser({
      nom: this.createForm.nom.trim(),
      prenom: this.createForm.prenom.trim(),
      email: this.createForm.email.trim(),
      roleId: this.createForm.roleId,
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.creating.set(false);
          this.notification.dismiss();
        })
      )
      .subscribe({
        next: (response: CreateUserResponse) => {
          if (response.emailSent === true) {
            this.notification.success(`Utilisateur créé avec succès. Un email avec les identifiants de connexion a été envoyé à ${response.email}.`);
          } else if (response.emailSent === false) {
            this.notification.error(`Utilisateur créé, mais l'email avec les identifiants n'a pas pu être envoyé à ${response.email}. Transmettez-lui ses identifiants manuellement.`);
          } else {
            this.notification.success('Utilisateur créé avec succès.');
          }
          this.closeCreateModal();
          this.loadUsers();
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 0
            ? 'Impossible de se connecter au serveur.'
            : err.error?.message || err.error?.title || (err.status === 400 ? 'Données invalides.' : 'Échec de la création de l\'utilisateur.');
          this.createError = msg;
          this.notification.error(msg);
        }
      });
  }

  openEditModal(user: AdminUser): void {
    this.selectedUser.set(user);
    this.selectedRoleId.set(user.roleId);
    this.modalError = '';
    this.notification.loading('Chargement des permissions…');

    this.adminService.getUserPermissions(user.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.notification.dismiss())
      )
      .subscribe({
        next: (perms) => {
          this.permissions.set(perms);
          this.showEditModal.set(true);
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 0
            ? 'Impossible de se connecter au serveur.'
            : 'Échec du chargement des permissions.';
          this.modalError = msg;
          this.notification.error(msg);
          // Still open modal without permissions
          this.permissions.set([]);
          this.showEditModal.set(true);
        }
      });
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.selectedUser.set(null);
    this.selectedRoleId.set(0);
    this.permissions.set([]);
    this.modalError = '';
  }

  togglePermission(index: number): void {
    this.permissions.update((perms) => {
      const updated = [...perms];
      updated[index] = { ...updated[index], isEnabled: !updated[index].isEnabled };
      return updated;
    });
  }

  onSave(): void {
    const user = this.selectedUser();
    if (!user) return;

    const newRoleId = this.selectedRoleId();

    // Rôle global inchangé → pas de mise à jour de rôle ni de popup d'impact
    if (newRoleId === user.roleId) {
      this.saveRoleAndPermissions(user, []);
      return;
    }

    this.saving.set(true);
    this.modalError = '';
    this.notification.loading('Vérification de l\'impact du changement de rôle…');

    this.adminService.getRoleChangeImpact(user.id, newRoleId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.saving.set(false);
          this.notification.dismiss();
        })
      )
      .subscribe({
        next: (impact) => {
          // Aucun projet concerné → application directe, sans friction
          if (impact.length === 0) {
            this.saveRoleAndPermissions(user, []);
            return;
          }

          // Écarts détectés → popup de confirmation par projet
          this.roleChangeImpact.set(impact);
          this.roleChangeNewRoleLabel.set(this.getRoleLabel(newRoleId));
          const align: Record<number, boolean> = {};
          for (const item of impact) {
            align[item.projectId] = true; // défaut : aligner sur le nouveau rôle global
          }
          this.roleChangeAlign.set(align);
          this.showRoleChangeModal.set(true);
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 0
            ? 'Impossible de se connecter au serveur.'
            : err.status === 400
              ? 'Données invalides.'
              : 'Échec de la vérification de l\'impact du changement de rôle.';
          this.modalError = msg;
          this.notification.error(msg);
        }
      });
  }

  /** Applique le changement de rôle global, puis les permissions */
  private saveRoleAndPermissions(user: AdminUser, decisions: ProjectRoleDecision[]): void {
    this.saving.set(true);
    this.modalError = '';
    this.notification.loading('Mise à jour en cours…');

    this.adminService.updateUserRole(user.id, this.selectedRoleId(), decisions)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.saving.set(false);
          this.notification.dismiss();
        })
      )
      .subscribe({
        next: () => {
          // After role update, update permissions
          this.adminService.updateUserPermissions(user.id, this.permissions())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                this.notification.success('Utilisateur mis à jour avec succès.');
                this.closeEditModal();
                this.loadUsers();
              },
              error: (err: HttpErrorResponse) => {
                const msg = err.status === 0
                  ? 'Impossible de se connecter au serveur.'
                  : 'Échec de la mise à jour des permissions.';
                this.modalError = msg;
                this.notification.error(msg);
              }
            });
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 0
            ? 'Impossible de se connecter au serveur.'
            : err.status === 400
              ? 'Données invalides.'
              : 'Échec de la mise à jour du rôle.';
          this.modalError = msg;
          this.notification.error(msg);
        }
      });
  }

  /** Libellé d'un rôle global depuis son id (délégué au helper partagé). */
  getRoleLabel(roleId: number): string {
    return sharedGetRoleLabel(roleId);
  }

  /** Inverse le choix d'alignement pour un projet donné */
  toggleRoleChangeAlign(projectId: number): void {
    this.roleChangeAlign.update((align) => ({
      ...align,
      [projectId]: !align[projectId],
    }));
  }

  confirmRoleChange(): void {
    const user = this.selectedUser();
    if (!user) return;

    const decisions: ProjectRoleDecision[] = this.roleChangeImpact().map((item) => ({
      projectId: item.projectId,
      alignToNewRole: this.roleChangeAlign()[item.projectId] ?? false,
    }));

    this.closeRoleChangeModal();
    this.saveRoleAndPermissions(user, decisions);
  }

  closeRoleChangeModal(): void {
    this.showRoleChangeModal.set(false);
    this.roleChangeImpact.set([]);
    this.roleChangeNewRoleLabel.set('');
    this.roleChangeAlign.set({});
  }

  onRoleChangeBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeRoleChangeModal();
    }
  }

  onDeleteUser(user: AdminUser): void {
    Swal.fire({
      title: 'Confirmer la suppression',
      html: `Êtes-vous sûr de vouloir supprimer l'utilisateur <strong>"${user.prenom} ${user.nom}"</strong> (${user.email}) ?<br/><br/>Cette action est <strong>irréversible</strong>.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler',
      reverseButtons: true,
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.notification.loading('Suppression de l\'utilisateur…');

      this.adminService.deleteUser(user.id)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize(() => this.notification.dismiss())
        )
        .subscribe({
          next: () => {
            this.notification.success('Utilisateur supprimé avec succès.');
            // Remove locally so the filtered list updates without a page reload
            this.users.update((users) => users.filter((u) => u.id !== user.id));
          },
          error: (err: HttpErrorResponse) => {
            const msg = err.status === 0
              ? 'Impossible de se connecter au serveur.'
              : err.error?.message || err.error?.title || (err.status === 400 ? 'Impossible de supprimer votre propre compte.' : 'Échec de la suppression de l\'utilisateur.');
            this.error.set(msg);
            this.notification.error(msg);
          }
        });
    });
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeEditModal();
    }
  }
}


