import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';
import { AdminService, AdminUser, CreateUserResponse, UserPermission, Role } from '../../services/admin.service';
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

  users = signal<AdminUser[]>([]);
  loading = signal(false);
  error = signal('');

  // Create modal state
  showCreateModal = signal(false);
  createForm = {
    nom: '',
    prenom: '',
    email: '',
    password: '',
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

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.error.set('');
    this.notification.loading('Chargement des utilisateurs…');

    this.adminService.getUsers()
      .pipe(finalize(() => {
        this.loading.set(false);
        this.notification.dismiss();
      }))
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
    this.createForm = { nom: '', prenom: '', email: '', password: '', roleId: 4 };
    this.createError = '';
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.createError = '';
  }

  onCreateUser(): void {
    // Basic validation
    if (!this.createForm.nom.trim() || !this.createForm.prenom.trim() || !this.createForm.email.trim() || !this.createForm.password.trim()) {
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

    // Password minimum length
    if (this.createForm.password.trim().length < 6) {
      this.createError = 'Le mot de passe doit contenir au moins 6 caractères.';
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
      password: this.createForm.password.trim(),
      roleId: this.createForm.roleId,
    })
      .pipe(finalize(() => {
        this.creating.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: (response: CreateUserResponse) => {
          if (response.emailSent === true) {
            this.notification.success('Utilisateur créé avec succès. Un email lui a été envoyé.');
          } else if (response.emailSent === false) {
            this.notification.success('Utilisateur créé avec succès, mais l\'email n\'a pas pu être envoyé.');
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
      .pipe(finalize(() => this.notification.dismiss()))
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

    this.saving.set(true);
    this.modalError = '';
    this.notification.loading('Mise à jour en cours…');

    this.adminService.updateUserRole(user.id, this.selectedRoleId())
      .pipe(
        finalize(() => {
          this.saving.set(false);
          this.notification.dismiss();
        })
      )
      .subscribe({
        next: () => {
          // After role update, update permissions
          this.adminService.updateUserPermissions(user.id, this.permissions())
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
        .pipe(finalize(() => this.notification.dismiss()))
        .subscribe({
          next: () => {
            this.notification.success('Utilisateur supprimé avec succès.');
            this.loadUsers();
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


