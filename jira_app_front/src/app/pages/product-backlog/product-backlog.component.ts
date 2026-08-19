import { Component, OnInit, signal, ViewChild, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { CdkDropListGroup, CdkDropList, CdkDrag, CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ProjectService, BacklogResponse, BacklogTicket, CreateTicketRequest } from '../../services/project.service';
import { ProjectStateService } from '../../services/project-state.service';
import { TicketService } from '../../services/ticket.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../shared/services/notification.service';
import { ProjectMembersService, AvailableUser } from '../../services/project-members.service';
import { SprintModalComponent } from './sprint-modal/sprint-modal.component';
import { CompleteSprintModalComponent } from './complete-sprint-modal/complete-sprint-modal.component';
import { CreateTicketModalComponent } from './create-ticket-modal/create-ticket-modal.component';
import { SprintCardComponent } from './sprint-card/sprint-card.component';
import { SubticketModalComponent } from '../../shared/components/subticket-modal/subticket-modal.component';
import { TicketDetailModalComponent } from '../../shared/components/ticket-detail-modal/ticket-detail-modal.component';
import { TicketCardComponent, Ticket } from '../projects/ticket-card/ticket-card.component';
import { AssignTicketModalComponent } from '../../shared/components/assign-ticket-modal/assign-ticket-modal.component';

@Component({
  selector: 'app-product-backlog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    SprintModalComponent,
    CompleteSprintModalComponent,
    CreateTicketModalComponent,
    SprintCardComponent,
    SubticketModalComponent,
    TicketDetailModalComponent,
    TicketCardComponent,
    AssignTicketModalComponent
  ],
  templateUrl: './product-backlog.component.html',
  styles: ``
})
export class ProductBacklogComponent implements OnInit {

  @ViewChild(SprintModalComponent) sprintModal!: SprintModalComponent;
  @ViewChild(CompleteSprintModalComponent) completeSprintModal!: CompleteSprintModalComponent;
  @ViewChild(CreateTicketModalComponent) createTicketModal!: CreateTicketModalComponent;
  @ViewChild(SubticketModalComponent) subticketModal!: SubticketModalComponent;
  @ViewChild(TicketDetailModalComponent) ticketDetailModal!: TicketDetailModalComponent;
  @ViewChild(AssignTicketModalComponent) assignTicketModal!: AssignTicketModalComponent;

  projectId: number = 0;
  projectName: string = '';

  // Data
  backlogData = signal<BacklogResponse | null>(null);
  loading = signal(false);
  error = signal('');
  noProjectAccess = signal(false);

  // Search
  searchQuery = '';
  filteredUnassignedTickets = signal<BacklogTicket[]>([]);

  // DnD
  unassignedDropListId = 'backlog-drop-list';

  /** Tickets non assignés à un sprint (réserve de backlog). */
  unassignedTickets = computed<BacklogTicket[]>(() =>
    (this.backlogData()?.backlogTickets || []).filter(t => t.sprintId == null)
  );

  // Refresh
  refreshing = signal(false);

  /** Team members */
  teamMembers = computed(() => {
    const seen = new Set<string>();
    const members: { name: string; avatar: string }[] = [];
    for (const t of this.filteredUnassignedTickets()) {
      if (t.assignedTo && !seen.has(t.assignedTo)) {
        seen.add(t.assignedTo);
        members.push({ name: t.assignedTo, avatar: t.assignedToAvatar || '' });
      }
    }
    return members;
  });

  userRole = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private ticketService: TicketService,
    private authService: AuthService,
    private notification: NotificationService,
    private projectState: ProjectStateService,
    private projectMembersService: ProjectMembersService,
    private destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.projectId = parseInt(idParam, 10);
      this.projectName = `Project #${this.projectId}`;
      // Mémorise le projet sélectionné pour le menu (Backlog / Tickets).
      this.projectState.setProject(this.projectId);
      this.loadBacklog();
      this.loadUserRole();
    }
  }

  private loadUserRole(): void {
    this.projectService.getMyRole(this.projectId).subscribe({
      next: (role) => {
        this.userRole.set(role.roleInProject);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 403) {
          this.noProjectAccess.set(true);
        }
        this.userRole.set(null);
      }
    });
  }

  /** Créer / éditer tickets, sous-tickets et sprints : Admin + ScrumMaster. */
  get canEditTickets(): boolean {
    return this.authService.isAdmin() || this.userRole() === 'ScrumMaster';
  }

  /** Gérer les sprints (créer / éditer / démarrer / terminer, déplacer des tickets) : Admin + ScrumMaster. */
  get canManageSprints(): boolean {
    return this.canEditTickets;
  }

  /** Assigner un Developer à un ticket : Admin + ScrumMaster + Senior. */
  get canAssignTickets(): boolean {
    const role = this.userRole();
    return this.authService.isAdmin() || role === 'ScrumMaster' || role === 'Senior';
  }

  /** Rôle de l'appelant pour le filtrage du modal d'assignation (Admin global → bypass complet). */
  get assignCallerRole(): string | null {
    return this.authService.isAdmin() ? 'Admin' : this.userRole();
  }

  /** Whether the current user is an Admin global */
  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  /** Ajouter un Developer comme membre du projet : Senior + Admin. */
  get canAssignDevelopers(): boolean {
    return this.authService.isAdmin() || this.userRole() === 'Senior';
  }

  // ==================== MODAL AFFECTER SENIOR ====================
  showSeniorModal = signal(false);
  availableSeniors = signal<AvailableUser[]>([]);
  loadingSeniors = signal(false);
  assigningSenior = signal(false);

  openSeniorModal(): void {
    this.loadingSeniors.set(true);
    this.showSeniorModal.set(true);
    this.notification.loading('Chargement des Seniors disponibles…');

    this.projectMembersService.getAvailableSeniors(this.projectId)
      .pipe(finalize(() => {
        this.loadingSeniors.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: (users) => this.availableSeniors.set(users),
        error: () => {
          this.availableSeniors.set([]);
          this.notification.error('Échec du chargement des Seniors disponibles.');
        }
      });
  }

  closeSeniorModal(): void {
    this.showSeniorModal.set(false);
    this.availableSeniors.set([]);
  }

  onAssignSenior(userId: number): void {
    this.assigningSenior.set(true);
    this.notification.loading('Affectation du Senior…');

    this.projectMembersService.addSeniorToProject(this.projectId, userId)
      .pipe(finalize(() => {
        this.assigningSenior.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: () => {
          this.notification.success('Senior affecté avec succès.');
          this.closeSeniorModal();
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.error?.message || err.error?.title || 'Échec de l\'affectation du Senior.';
          this.notification.error(msg);
        }
      });
  }

  // ==================== MODAL AFFECTER DEVELOPER ====================
  showDeveloperModal = signal(false);
  availableDevelopers = signal<AvailableUser[]>([]);
  loadingDevelopers = signal(false);
  assigningDeveloper = signal(false);

  openDeveloperModal(): void {
    this.loadingDevelopers.set(true);
    this.showDeveloperModal.set(true);
    this.notification.loading('Chargement des Developers disponibles…');

    this.projectMembersService.getAvailableDevelopers(this.projectId)
      .pipe(finalize(() => {
        this.loadingDevelopers.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: (users) => this.availableDevelopers.set(users),
        error: () => {
          this.availableDevelopers.set([]);
          this.notification.error('Échec du chargement des Developers disponibles.');
        }
      });
  }

  closeDeveloperModal(): void {
    this.showDeveloperModal.set(false);
    this.availableDevelopers.set([]);
  }

  onAssignDeveloper(userId: number): void {
    this.assigningDeveloper.set(true);
    this.notification.loading('Affectation du Developer…');

    this.projectMembersService.addDeveloperToProject(this.projectId, userId)
      .pipe(finalize(() => {
        this.assigningDeveloper.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: () => {
          this.notification.success('Developer affecté avec succès.');
          this.closeDeveloperModal();
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.error?.message || err.error?.title || 'Échec de l\'affectation du Developer.';
          this.notification.error(msg);
        }
      });
  }

  loadBacklog(): void {
    if (this.loading()) return;

    this.loading.set(true);
    this.error.set('');

    this.projectService.getBacklog(this.projectId)
      .pipe(finalize(() => {
        this.loading.set(false);
        this.refreshing.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: (data) => {
          this.backlogData.set(data);
          this.applySearch();
          this.notification.success('Backlog chargé avec succès.');
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 403) {
            this.noProjectAccess.set(true);
            return;
          }
          const msg = err.status === 0 ? 'Impossible de se connecter au serveur.'
                     : err.status === 404 ? 'Projet introuvable.'
                     : 'Échec du chargement du backlog.';
          this.error.set(msg);
          this.notification.error(msg);
        }
      });
  }

  // Search
  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.applySearch();
  }

  private applySearch(): void {
    const q = this.searchQuery.toLowerCase().trim();
    const backlog = this.unassignedTickets();

    if (!q) {
      this.filteredUnassignedTickets.set(backlog);
      return;
    }

    this.filteredUnassignedTickets.set(
      backlog.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.priority?.toLowerCase().includes(q) ||
        t.status?.toLowerCase().includes(q) ||
        t.assignedTo?.toLowerCase().includes(q)
      )
    );
  }

  getConnectedDropListIds(): string[] {
    const ids: string[] = [this.unassignedDropListId];
    if (this.backlogData()?.sprints) {
      for (const sprint of this.backlogData()!.sprints) {
        ids.push(`sprint-${sprint.id}`);
      }
    }
    return ids;
  }

  /**
   * Drag & Drop d'un ticket entre la réserve de backlog et les sprints.
   * targetSprintId === null → le ticket retourne dans la réserve (non assigné).
   */
  onTicketDrop(event: CdkDragDrop<BacklogTicket[]>, targetSprintId: number | null): void {
    if (event.previousContainer === event.container) return;

    const movedTicket = event.previousContainer.data[event.previousIndex];
    const targetId = targetSprintId ?? null;
    const previousSprintId = movedTicket.sprintId ?? null;

    // Optimistic UI : déplacement immédiat dans la liste cible.
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
    movedTicket.sprintId = targetId;
    this.commitBacklog();
    this.applySearch();

    this.notification.loading('Déplacement du ticket…');
    this.ticketService.updateTicketSprint(movedTicket.id, targetId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.notification.dismiss())
      )
      .subscribe({
        next: () => {
          this.notification.success('Ticket déplacé avec succès.');
          this.loadBacklog();
        },
        error: (err: HttpErrorResponse) => {
          // Rollback si l'API échoue.
          transferArrayItem(
            event.container.data,
            event.previousContainer.data,
            event.currentIndex,
            event.previousIndex
          );
          movedTicket.sprintId = previousSprintId;
          this.commitBacklog();
          this.applySearch();
          if (err.status === 409) {
            this.notification.error(err.error?.message || 'Ce ticket ne peut plus être déplacé : échéance dans ≤ 30 minutes.');
          } else {
            this.notification.error('Échec du déplacement du ticket.');
          }
        }
      });
  }

  /** Force la réémission des tableaux imbriqués pour rafraîchir le rendu après un DnD. */
  private commitBacklog(): void {
    const data = this.backlogData();
    if (!data) return;
    this.backlogData.set({
      ...data,
      backlogTickets: [...data.backlogTickets],
      sprints: data.sprints.map(s => ({ ...s, tickets: [...s.tickets] })),
    });
  }

  /** Démarrer / Terminer un sprint (Admin). "Terminer" ouvre la modale de clôture. */
  onSprintAction(data: { sprintId: number; action: 'start' | 'complete' }): void {
    if (data.action === 'complete') {
      this.openCompleteSprintModal(data.sprintId);
      return;
    }
    this.startSprint(data.sprintId);
  }

  /** Démarre directement le sprint (statut → Active). */
  private startSprint(sprintId: number): void {
    this.notification.loading('Démarrage du sprint…');

    this.projectService.updateSprint(sprintId, { status: 'Active' })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.notification.dismiss())
      )
      .subscribe({
        next: () => {
          this.loadBacklog();
          this.notification.success('Sprint démarré avec succès.');
        },
        error: () => {
          this.notification.error('Échec de la mise à jour du sprint.');
        }
      });
  }

  /** Ouvre la modale de clôture avec le sprint et les autres sprints (destinations possibles). */
  openCompleteSprintModal(sprintId: number): void {
    const sprint = this.backlogData()?.sprints.find(s => s.id === sprintId);
    if (!sprint) return;
    const otherSprints = (this.backlogData()?.sprints || []).filter(s => s.id !== sprintId);
    this.completeSprintModal.open(sprint, otherSprints);
  }

  /** Rafraîchit le backlog (sprints + kanban) après clôture d'un sprint. */
  onSprintCompleted(): void {
    this.loadBacklog();
  }

  // ==================== CRÉATION TICKET (CORRIGÉ) ====================
  openCreateTicketModal(sprintId?: number): void {
    this.createTicketModal.sprintId = sprintId ?? null;
    this.createTicketModal.open();
  }

  onCreateTicket(data: CreateTicketRequest): void {
    this.notification.loading('Création du ticket…');

    // Mapping pour corriger "titre" -> "title" si nécessaire
    const payload = {
      ...data,
      title: (data as any).titre || (data as any).title,
      projectId: this.projectId
    };

    this.projectService.createTicket(payload)
      .pipe(finalize(() => this.notification.dismiss()))
      .subscribe({
        next: () => {
          this.loadBacklog();
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

  onGoalUpdated(data: { sprintId: number; goal: string }): void {
    this.notification.loading('Mise à jour du goal…');
    this.projectService.updateSprint(data.sprintId, { goal: data.goal })
      .pipe(finalize(() => this.notification.dismiss()))
      .subscribe({
        next: () => {
          this.notification.success('Goal mis à jour avec succès.');
          this.loadBacklog();
        },
        error: () => {
          this.notification.error('Échec de la mise à jour du goal.');
        }
      });
  }

  // ==================== SPRINT ====================
  goToKanban(sprintId: number): void {
    this.projectState.setSprint(sprintId);
    this.router.navigate(['/projects', this.projectId, 'sprint', sprintId, 'kanban']);
  }

  /** Ouvre la modale de création d'un sprint. */
  openCreateSprintModal(): void {
    this.sprintModal.open();
  }

  /** Ouvre la modale d'édition d'un sprint (pré-remplie). */
  openEditSprintModal(sprintId: number): void {
    const sprint = this.backlogData()?.sprints.find(s => s.id === sprintId);
    if (sprint) {
      this.sprintModal.open(sprint);
    }
  }

  /** Rafraîchit la liste des sprints après création / mise à jour. */
  onSprintSaved(): void {
    this.loadBacklog();
  }

  getCreatorId(): string {
    return this.authService.getUserId() || '';
  }

  trackByTicketId(index: number, ticket: BacklogTicket): number {
    return ticket.id;
  }

  // ==================== SOUS-TICKETS ====================
  openSubticketModal(ticketId: number): void {
    this.subticketModal.open(ticketId);
  }

  onSubticketCreated(): void {
    this.loadBacklog();
  }

  // ==================== DÉTAIL TICKET ====================
  /** Ouvre la modale de détail / édition d'un ticket de la réserve ou d'un sprint. */
  openTicketDetail(ticketId: number): void {
    const all = [
      ...(this.backlogData()?.backlogTickets || []),
      ...(this.backlogData()?.sprints || []).flatMap(s => s.tickets || [])
    ];
    const ticket = all.find(t => t.id === ticketId);
    if (ticket) {
      this.ticketDetailModal.open(ticket);
    }
  }

  // ==================== ASSIGNATION TICKET ====================
  /** Ouvre le modal d'assignation depuis la zone avatar/nom d'une carte ticket. */
  openAssignTicketModal(ticket: Ticket): void {
    this.assignTicketModal.open(ticket.id, ticket.title);
  }

  onTicketAssigned(): void {
    this.loadBacklog();
  }

  mapToTicket(ticket: BacklogTicket): Ticket {
    return {
      id: ticket.id,
      title: ticket.title || (ticket as any).titre || '',
      priority: (ticket.priority as Ticket['priority']) || 'Medium',
      assignedUser: {
        name: ticket.assignedTo || 'Unassigned',
        avatar: ticket.assignedToAvatar || ''
      },
      dueDate: ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString() : '',
      labels: [],
      description: ticket.description || '',
      status: (ticket.status as Ticket['status']) || 'todo',
      color: ticket.color,
      subTickets: (ticket.subTickets || []).map(sub => this.mapToTicket(sub)),
      isExpanded: false
    };
  }

  /** Vérifie si un ticket est verrouillé (échéance dans ≤ 30 minutes ou dépassée). */
  isTicketLocked(ticket: BacklogTicket): boolean {
    if (!ticket.dueDate) return false;
    const due = new Date(ticket.dueDate);
    if (isNaN(due.getTime())) return false;
    const now = new Date();
    const threshold = new Date(due.getTime() - 30 * 60 * 1000);
    return now >= threshold;
  }

  /** Vérifie si le drag est désactivé pour un ticket donné. */
  isDragDisabled(ticket: BacklogTicket): boolean {
    return !this.canEditTickets || this.isTicketLocked(ticket);
  }

  /** Suppression définitive d'un ticket — Admin uniquement. */
  onDeleteTicket(ticketId: number): void {
    this.notification.loading('Suppression du ticket…');

    this.ticketService.deleteTicket(ticketId)
      .pipe(finalize(() => this.notification.dismiss()))
      .subscribe({
        next: () => {
          this.loadBacklog();
          this.notification.success('Ticket supprimé définitivement.');
        },
        error: () => {
          this.notification.error('Échec de la suppression du ticket.');
        }
      });
  }
}