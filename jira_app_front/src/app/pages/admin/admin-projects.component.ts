import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../shared/services/notification.service';

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

  projects = signal<AdminProject[]>([]);
  loading = signal(false);
  error = signal('');

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
}


