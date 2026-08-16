import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../shared/services/notification.service';
import { ProjectMembersService, AvailableUser } from '../../services/project-members.service';

export interface AdminProject {
  id: number;
  nom: string;
  responsable?: string;
  memberCount: number;
  sprintCount?: number;
  ticketCount?: number;
}

@Component({
  selector: 'app-admin-projects',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-projects.component.html',
  styles: ``,
})
export class AdminProjectsComponent implements OnInit {
  private adminService = inject(AdminService);
  private notification = inject(NotificationService);
  private projectMembersService = inject(ProjectMembersService);

  projects = signal<AdminProject[]>([]);
  loading = signal(false);
  error = signal('');

  showAssignModal = signal(false);
  assignModalProject = signal<AdminProject | null>(null);
  availableScrumMasters = signal<AvailableUser[]>([]);
  loadingScrumMasters = signal(false);
  assigning = signal(false);

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.loading.set(true);
    this.error.set('');
    this.notification.loading('Chargement des projets…');

    this.adminService.getProjects()
      .pipe(finalize(() => {
        this.loading.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: (data) => {
          this.projects.set(data as AdminProject[]);
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 0
            ? 'Impossible de se connecter au serveur.'
            : err.status === 500
              ? 'Serveur indisponible.'
              : 'Échec du chargement des projets.';
          this.error.set(msg);
          this.notification.error(msg);
        }
      });
  }

  openAssignModal(project: AdminProject): void {
    this.assignModalProject.set(project);
    this.loadingScrumMasters.set(true);
    this.showAssignModal.set(true);
    this.notification.loading('Chargement des ScrumMasters disponibles…');

    this.projectMembersService.getAvailableScrumMasters(project.id)
      .pipe(finalize(() => {
        this.loadingScrumMasters.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: (users) => this.availableScrumMasters.set(users),
        error: () => {
          this.availableScrumMasters.set([]);
          this.notification.error('Échec du chargement des ScrumMasters disponibles.');
        }
      });
  }

  closeAssignModal(): void {
    this.showAssignModal.set(false);
    this.assignModalProject.set(null);
    this.availableScrumMasters.set([]);
  }

  onAssignScrumMaster(userId: number): void {
    const project = this.assignModalProject();
    if (!project) return;

    this.assigning.set(true);
    this.notification.loading('Affectation du ScrumMaster…');

    this.projectMembersService.addScrumMasterToProject(project.id, userId)
      .pipe(finalize(() => {
        this.assigning.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: () => {
          this.notification.success('ScrumMaster affecté avec succès.');
          this.closeAssignModal();
          this.loadProjects();
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.error?.message || err.error?.title || 'Échec de l\'affectation du ScrumMaster.';
          this.notification.error(msg);
        }
      });
  }
}


