import { Component, OnInit, signal, inject } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ProjectCardComponent } from '../projects/project-card/project-card.component';
import { ProjectService, BackendProject, CreateProjectRequest } from '../../services/project.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule, ProjectCardComponent],
  templateUrl: './dashboard.component.html',
  styles: ``
})
export class DashboardComponent implements OnInit {
  // Projects from backend
  projects = signal<BackendProject[]>([]);
  loading = signal(false);
  error = signal('');

  // Create project modal
  showCreateModal = signal(false);
  newProjectName = '';
  newProjectDescription = '';
  newProjectResponsable = '';
  savingProject = signal(false);
  projectError = '';

  private notification = inject(NotificationService);

  constructor(
    private projectService: ProjectService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Only load projects if the user is authenticated
    // (the AuthGuard on the route should already prevent unauthenticated access,
    //  but this is an additional safety net to avoid unnecessary API calls)
    if (!this.authService.isAuthenticated) {
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }
    this.loadProjects();
  }

  loadProjects(): void {
    this.loading.set(true);
    this.error.set('');
    this.notification.loading('Chargement des projets…');

    this.projectService.getProjects()
      .pipe(finalize(() => {
        this.loading.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: (data) => {
          this.projects.set(data);
          this.notification.success('Projets chargés avec succès.');
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 0
            ? 'Impossible de se connecter au serveur.'
            : err.status === 401 || err.status === 403
              ? 'Session expirée.'
              : err.status === 500
                ? 'Serveur indisponible.'
                : 'Échec du chargement des projets.';
          this.error.set(msg);
          this.notification.error(msg);
          if (err.status === 401 || err.status === 403) {
            this.router.navigate(['/login']);
          }
        }
      });
  }

  // Open create project modal
  openCreateProjectModal(): void {
    this.newProjectName = '';
    this.newProjectDescription = '';
    this.newProjectResponsable = '';
    this.projectError = '';
    this.showCreateModal.set(true);
  }

  closeCreateProjectModal(): void {
    this.showCreateModal.set(false);
  }

  onCreateProject(): void {
    if (!this.newProjectName.trim()) {
      this.projectError = 'Le nom du projet est requis.';
      this.notification.validation('Le nom du projet est requis.');
      return;
    }

    this.savingProject.set(true);
    this.projectError = '';
    this.notification.loading('Création du projet…');

    const data: CreateProjectRequest = {
      nom: this.newProjectName.trim(),
      description: this.newProjectDescription.trim(),
      responsable: this.newProjectResponsable.trim(),
      memberIds: []
    };

    this.projectService.createProject(data)
      .pipe(finalize(() => {
        this.savingProject.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: () => {
          this.showCreateModal.set(false);
          this.loadProjects();
          this.notification.success('Projet créé avec succès.');
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 400
            ? 'Données du projet invalides.'
            : err.status === 500
              ? 'Serveur indisponible.'
              : 'Échec de la création du projet.';
          this.projectError = msg;
          this.notification.error(msg);
        }
      });
  }

  goToProjectBacklog(project: BackendProject): void {
    this.router.navigate(['/projects', project.id, 'backlog']);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeCreateProjectModal();
    }
  }
}

