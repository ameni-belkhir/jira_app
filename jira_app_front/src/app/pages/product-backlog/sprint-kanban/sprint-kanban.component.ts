import { Component, Input, OnInit, signal, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, moveItemInArray, transferArrayItem, CdkDropList, CdkDrag } from '@angular/cdk/drag-drop';
import { TicketService, SprintTicket } from '../../../services/ticket.service';
import { ProjectMembersService, AvailableUser } from '../../../services/project-members.service';
import { TicketCardComponent, Ticket } from '../../projects/ticket-card/ticket-card.component';
import { NotificationService } from '../../../shared/services/notification.service';
import { CreateTicketModalComponent } from '../create-ticket-modal/create-ticket-modal.component';
import { AuthService } from '../../../services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';
import { CreateTicketRequest, ProjectService } from '../../../services/project.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-sprint-kanban',
  standalone: true,
  imports: [CommonModule, FormsModule, CdkDropList, CdkDrag, TicketCardComponent, CreateTicketModalComponent],
  templateUrl: './sprint-kanban.component.html',
  styles: ``
})
export class SprintKanbanComponent implements OnInit {
  @Input({ required: true }) sprintId!: number;
  @Input({ required: true }) projectId!: number;
  @ViewChild(CreateTicketModalComponent) createTicketModal!: CreateTicketModalComponent;

  aFaire = signal<SprintTicket[]>([]);
  enCours = signal<SprintTicket[]>([]);
  fait = signal<SprintTicket[]>([]);

  loading = signal(false);
  error = signal('');
  userRole = signal<string | null>(null);

  private notification = inject(NotificationService);

  // Assign Developer modal state
  showAssignDeveloperModal = signal(false);
  availableDevelopers = signal<AvailableUser[]>([]);
  loadingDevelopers = signal(false);
  assigningDeveloper = signal(false);

  constructor(
    private ticketService: TicketService,
    private projectService: ProjectService,
    private projectMembersService: ProjectMembersService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.checkAccessAndLoad();
  }

  /** Open the "Assign Developer" modal */
  openAssignDeveloperModal(): void {
    this.loadingDevelopers.set(true);
    this.showAssignDeveloperModal.set(true);
    this.notification.loading('Chargement des développeurs disponibles…');

    this.projectMembersService.getAvailableDevelopers(this.projectId)
      .pipe(finalize(() => {
        this.loadingDevelopers.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: (developers) => {
          this.availableDevelopers.set(developers);
        },
        error: () => {
          this.availableDevelopers.set([]);
          this.notification.error('Échec du chargement des développeurs disponibles.');
        }
      });
  }

  closeAssignDeveloperModal(): void {
    this.showAssignDeveloperModal.set(false);
    this.availableDevelopers.set([]);
  }

  /** Assign a developer to the project */
  onAssignDeveloper(userId: number): void {
    this.assigningDeveloper.set(true);
    this.notification.loading('Affectation du développeur…');

    this.projectMembersService.addDeveloperToProject(this.projectId, userId)
      .pipe(finalize(() => {
        this.assigningDeveloper.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: () => {
          this.notification.success('Le développeur a été affecté avec succès.');
          this.closeAssignDeveloperModal();
        },
        error: () => {
          this.notification.error('Échec de l\'affectation du développeur.');
        }
      });
  }

  private checkAccessAndLoad(): void {
    if (!this.projectId) {
      this.loadTickets();
      return;
    }

    this.projectService.getMyRole(this.projectId).subscribe({
      next: (role) => {
        this.userRole.set(role.roleInProject);
        if (!role.roleInProject) {
          this.notification.error('Accès non autorisé à ce projet.');
          this.router.navigate(['/dashboard']);
          return;
        }
        this.loadTickets();
      },
      error: () => {
        this.notification.error('Accès non autorisé à ce projet.');
        this.router.navigate(['/dashboard']);
      }
    });
  }

  /** Whether the current user can create/edit/delete tickets (ScrumMaster or Senior) */
  get canManageTickets(): boolean {
    const role = this.userRole();
    return role === 'ScrumMaster' || role === 'Senior';
  }

  loadTickets(): void {
    if (!this.sprintId) return;

    this.loading.set(true);
    this.error.set('');
    this.notification.loading('Chargement des tickets du sprint…');

    this.ticketService.getTicketsBySprint(this.sprintId)
      .pipe(finalize(() => {
        this.loading.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: (tickets) => {
          this.distributeTickets(tickets);
          this.notification.success('Tickets du sprint chargés.');
        },
        error: () => {
          const msg = 'Impossible de charger les tickets du sprint.';
          this.error.set(msg);
          this.notification.error(msg);
        }
      });
  }

  private distributeTickets(tickets: SprintTicket[]): void {
    const aFaire: SprintTicket[] = [];
    const enCours: SprintTicket[] = [];
    const fait: SprintTicket[] = [];

    for (const ticket of tickets) {
      const status = ticket.status?.toUpperCase() || '';
      if (status === 'EN_COURS') {
        enCours.push(ticket);
      } else if (status === 'TERMINE' || status === 'FAIT' || status === 'DONE' || status === 'COMPLETED') {
        fait.push(ticket);
      } else {
        aFaire.push(ticket);
      }
    }

    this.aFaire.set(aFaire);
    this.enCours.set(enCours);
    this.fait.set(fait);
  }

  private getStatusForColumn(containerId: string): string {
    switch (containerId) {
      case 'a-faire': return 'A_FAIRE';
      case 'en-cours': return 'EN_COURS';
      case 'fait': return 'TERMINE';
      default: return 'A_FAIRE';
    }
  }

  onDrop(event: CdkDragDrop<SprintTicket[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }

    const ticket = event.previousContainer.data[event.previousIndex];
    const newStatus = this.getStatusForColumn(event.container.id);

    // Update local state immediately for responsiveness
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    this.aFaire.set([...this.aFaire()]);
    this.enCours.set([...this.enCours()]);
    this.fait.set([...this.fait()]);

    console.log('[Kanban] Déplacement ticket → ticketId:', ticket.id, 'nouveauStatus:', newStatus);
    this.notification.loading('Mise à jour du statut…');

    // Call API to persist the status change (optimistic update — never reload)
    this.ticketService.updateStatus(ticket.id, newStatus)
      .pipe(finalize(() => this.notification.dismiss()))
      .subscribe({
        next: () => this.notification.success('Statut du ticket mis à jour.'),
        error: () => {
          const msg = 'Erreur lors de la mise à jour du statut.';
          this.error.set(msg);
          this.notification.error(msg);
        }
      });
  }

  // ==================== CRÉATION TICKET ====================
  openCreateTicketModal(): void {
    this.createTicketModal.sprintId = this.sprintId;
    this.createTicketModal.open();
  }

  onCreateTicket(data: CreateTicketRequest): void {
    this.notification.loading('Création du ticket…');

    const payload = {
      ...data,
      title: (data as any).titre || (data as any).title,
      projectId: this.projectId
    };

    this.projectService.createTicket(payload)
      .pipe(finalize(() => this.notification.dismiss()))
      .subscribe({
        next: () => {
          this.loadTickets();
          this.notification.success('Ticket créé avec succès.');
        },
        error: (err: HttpErrorResponse) => {
          console.error('Erreur création ticket:', err.error);
          const msg = err.error?.message || err.error?.title || 'Données du ticket invalides.';
          this.error.set(msg);
          this.notification.error(msg);
        }
      });
  }

  getCreatorId(): string {
    return this.authService.getUserId() || '';
  }

  trackByTicketId(index: number, ticket: SprintTicket): number {
    return ticket.id;
  }

  mapToTicket(ticket: SprintTicket): Ticket {
    return {
      id: ticket.id,
      title: ticket.title,
      priority: (ticket.priority as Ticket['priority']) || 'Medium',
      assignedUser: {
        name: ticket.assignedTo || 'Unassigned',
        avatar: ticket.assignedToAvatar || ''
      },
      dueDate: '',
      labels: [],
      description: ticket.description || '',
      status: 'todo' as Ticket['status'],
      color: ticket.color
    };
  }
}
