import { Component, OnInit, signal } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ProjectCardComponent } from '../projects/project-card/project-card.component';
import { ProjectService, BackendProject, CreateProjectRequest } from '../../services/project.service';

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
  savingProject = signal(false);
  projectError = '';

  constructor(
    private projectService: ProjectService,
    private router: Router
  ) {}

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
          } else if (err.status === 401 || err.status === 403) {
            this.error.set('Session expired. Please log in again.');
            this.router.navigate(['/login']);
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
    this.projectError = '';
    this.showCreateModal.set(true);
  }

  closeCreateProjectModal(): void {
    this.showCreateModal.set(false);
  }

  onCreateProject(): void {
    if (!this.newProjectName.trim()) {
      this.projectError = 'Project name is required.';
      return;
    }

    this.savingProject.set(true);
    this.projectError = '';

    const data: CreateProjectRequest = {
      name: this.newProjectName.trim(),
      description: this.newProjectDescription.trim()
    };

    this.projectService.createProject(data)
      .pipe(finalize(() => this.savingProject.set(false)))
      .subscribe({
        next: () => {
          this.showCreateModal.set(false);
          this.loadProjects(); // Refresh dashboard
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
}

