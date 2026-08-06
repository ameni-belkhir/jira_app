import { Component, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectCardComponent } from './project-card/project-card.component';
import { ProjectService, BackendProject, CreateProjectRequest, UpdateProjectRequest, AvailableScrumMaster } from '../../services/project.service';
import { ProjectMembersService } from '../../services/project-members.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../shared/services/notification.service';
import { UserRoleSelectorComponent, RoleSelectableUser } from '../../shared/components/user-role-selector/user-role-selector.component';
import { ProjectPlanBridgeService } from '../../shared/services/project-plan-bridge.service';
import { finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule, ProjectCardComponent, UserRoleSelectorComponent],
  templateUrl: './projects.component.html',
  styles: ``
})
export class ProjectsComponent implements OnInit {
  projects = signal<BackendProject[]>([]);
  loading = signal(false);
  error = signal('');

  // Create project modal
  showCreateModal = signal(false);
  newProjectName = '';
  newProjectDescription = '';
  selectedScrumMasterIds: number[] = [];
  savingProject = signal(false);
  projectError = '';

  isAdmin = false;

  /** Track which project is currently being deleted (for loading spinner) */
  deletingProjectId = signal<number | null>(null);

  // Available Scrum Masters for the multi-select
  availableScrumMasters: AvailableScrumMaster[] = [];
  loadingScrumMasters = signal(false);

  // Edit project modal
  showEditModal = signal(false);
  editingProjectId: number | null = null;
  editProjectName = '';
  editProjectDescription = '';
  editProjectResponsable = '';
  editSelectedScrumMasterIds: number[] = [];
  savingEditProject = signal(false);
  editProjectError = '';
  editLoadingScrumMasters = signal(false);
  editAvailableScrumMasters: AvailableScrumMaster[] = [];

// User role
  userRole: string | null = null;

  /** Met en valeur visuellement les champs pré-remplis par l'IA. */
  highlightPrefilled = signal(false);

  constructor(
    private projectService: ProjectService,
    private projectMembersService: ProjectMembersService,
    private authService: AuthService,
    private notification: NotificationService,
    private planBridge: ProjectPlanBridgeService
  ) {
    this.isAdmin = this.authService.isAdmin();
    this.userRole = this.authService.getRole();
  }

  // Check if user can edit/delete projects
  canManageProjects(): boolean {
    return this.isAdmin || this.userRole === 'ScrumMaster';
  }

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.loading.set(true);
    this.error.set('');

    this.projectService.getProjects()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.projects.set(data);
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 0) {
            this.error.set('Cannot connect to server. Please check your connection.');
          } else if (err.status === 500) {
            this.error.set('Server unavailable. Please try again later.');
          } else {
            this.error.set('Failed to load projects. Please try again.');
          }
        }
      });
  }

// Open create project modal
  openCreateProjectModal(): void {
    this.newProjectName = '';
    this.newProjectDescription = '';
    this.selectedScrumMasterIds = [];
    this.projectError = '';
    this.showCreateModal.set(true);
    this.loadScrumMasters();

    // Pré-remplissage automatique depuis le plan généré par l'IA (s'il existe)
    const plan = this.planBridge.plan();
    if (plan) {
      this.prefillFromPlan(plan);
    }
  }

  /**
   * Applique le plan de projet généré par l'IA au formulaire de création,
   * puis met en valeur les champs pré-remplis pendant 3 secondes.
   */
  private prefillFromPlan(plan: any): void {
    const name = plan?.projectName || plan?.nom || '';
    const description = plan?.projectDescription || plan?.description || '';

    if (name) this.newProjectName = name;
    if (description) this.newProjectDescription = description;

    if (name || description) {
      this.notification.success('Formulaire pré-rempli grâce à l\u2019IA !');

      // Met en valeur les champs pendant 3 secondes
      this.highlightPrefilled.set(true);
      setTimeout(() => this.highlightPrefilled.set(false), 3000);

      // Le plan est consommé : on le nettoie pour éviter un pré-remplissage répété
      this.planBridge.clearPlan();
    }
  }

  closeCreateProjectModal(): void {
    this.showCreateModal.set(false);
  }

  onScrumMasterSelectionChange(ids: number[]): void {
    this.selectedScrumMasterIds = ids;
  }

  private loadScrumMasters(): void {
    this.loadingScrumMasters.set(true);
    this.projectService.getAvailableScrumMasters()
      .pipe(finalize(() => this.loadingScrumMasters.set(false)))
      .subscribe({
        next: (users) => {
          this.availableScrumMasters = users;
        },
        error: () => {
          this.availableScrumMasters = [];
        }
      });
  }

  onCreateProject(): void {
    if (!this.newProjectName.trim()) {
      this.projectError = 'Project name is required.';
      return;
    }

    this.savingProject.set(true);
    this.projectError = '';

    const data: CreateProjectRequest = {
      nom: this.newProjectName.trim(),
      description: this.newProjectDescription.trim(),
      responsable: '',
      scrumMasterIds: this.selectedScrumMasterIds
    };

    this.projectService.createProject(data)
      .pipe(finalize(() => this.savingProject.set(false)))
      .subscribe({
        next: () => {
          this.notification.success('Projet créé avec succès.');
          this.showCreateModal.set(false);
          this.loadProjects();
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 400) {
            this.projectError = 'Invalid project data. Please check your inputs.';
          } else if (err.status === 500) {
            this.projectError = 'Server unavailable. Please try again later.';
          } else {
            this.projectError = 'Failed to create project. Please try again.';
          }
        }
      });
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeCreateProjectModal();
    }
  }

  // ===== EDIT PROJECT MODAL =====
  openEditProjectModal(project: BackendProject): void {
    this.editingProjectId = project.id;
    this.editProjectName = project.nom;
    this.editProjectDescription = project.description || '';
    this.editProjectResponsable = project.responsable || '';
    this.editSelectedScrumMasterIds = [];
    this.editProjectError = '';
    this.showEditModal.set(true);
    this.loadEditScrumMasters();
  }

  closeEditProjectModal(): void {
    this.showEditModal.set(false);
    this.editingProjectId = null;
  }

  private loadEditScrumMasters(): void {
    this.editLoadingScrumMasters.set(true);
    this.projectService.getAvailableScrumMasters()
      .pipe(finalize(() => this.editLoadingScrumMasters.set(false)))
      .subscribe({
        next: (users) => {
          this.editAvailableScrumMasters = users;
        },
        error: () => {
          this.editAvailableScrumMasters = [];
        }
      });
  }

  onEditScrumMasterSelectionChange(ids: number[]): void {
    this.editSelectedScrumMasterIds = ids;
  }

  onEditProject(): void {
    if (!this.editProjectName.trim()) {
      this.editProjectError = 'Project name is required.';
      return;
    }

    if (this.editingProjectId === null) {
      this.editProjectError = 'Project ID is missing.';
      return;
    }

    this.savingEditProject.set(true);
    this.editProjectError = '';

    const data: UpdateProjectRequest = {
      id: this.editingProjectId,
      nom: this.editProjectName.trim(),
      description: this.editProjectDescription.trim(),
      responsable: this.editProjectResponsable.trim(),
      scrumMasterIds: this.editSelectedScrumMasterIds
    };

    this.projectService.updateProject(this.editingProjectId, data)
      .pipe(finalize(() => this.savingEditProject.set(false)))
      .subscribe({
        next: () => {
          this.notification.success('Projet modifié avec succès.');
          this.showEditModal.set(false);
          this.loadProjects();
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 400) {
            this.editProjectError = 'Invalid project data. Please check your inputs.';
          } else if (err.status === 403) {
            this.editProjectError = 'You do not have permission to edit this project.';
          } else if (err.status === 404) {
            this.editProjectError = 'Project not found.';
          } else if (err.status === 500) {
            this.editProjectError = 'Server unavailable. Please try again later.';
          } else {
            this.editProjectError = 'Failed to update project. Please try again.';
          }
        }
      });
  }

  onBackdropEditClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeEditProjectModal();
    }
  }

onDeleteProject(project: BackendProject): void {
    Swal.fire({
      title: 'Supprimer le projet ?',
      html: `Êtes-vous sûr de vouloir supprimer <strong>"${project.nom}"</strong> ?<br/><br/>Attention, la suppression de ce projet entraînera la suppression définitive de tout son backlog, ses sprints et ses tickets.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler',
      reverseButtons: true,
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.deletingProjectId.set(project.id);
      this.notification.loading('Suppression du projet…');

      this.projectService.deleteProject(project.id)
        .pipe(finalize(() => {
          this.deletingProjectId.set(null);
          this.notification.dismiss();
        }))
        .subscribe({
          next: () => {
            this.projects.update((current) => current.filter((p) => p.id !== project.id));
            this.notification.success('Projet et toutes ses données associées supprimés avec succès.');
          },
          error: (err) => {
            console.error('Erreur lors de la suppression du projet:', err);
            const msg = err.status === 0
              ? 'Impossible de se connecter au serveur. Vérifiez votre connexion.'
              : err.status === 500
                ? 'Serveur indisponible. Veuillez réessayer plus tard.'
                : 'Impossible de supprimer le projet. Vérifiez la console ou les dépendances serveur.';
            this.error.set(msg);
            this.notification.error(msg);
          }
        });
    });
  }
}
