import { Component, OnInit, signal, ViewChild, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { CdkDropListGroup, CdkDropList, CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, interval, switchMap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ProjectService, BacklogResponse, BacklogTicket, CreateTicketRequest } from '../../services/project.service';
import { ProjectStateService } from '../../services/project-state.service';
import { TicketService } from '../../services/ticket.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../shared/services/notification.service';
import { ProjectMembersService, AvailableUser } from '../../services/project-members.service';
import { TicketNavigationService } from '../../services/ticket-navigation.service';
import { SprintModalComponent } from './sprint-modal/sprint-modal.component';
import { CompleteSprintModalComponent } from './complete-sprint-modal/complete-sprint-modal.component';
import { CreateTicketModalComponent } from './create-ticket-modal/create-ticket-modal.component';
import { SprintCardComponent } from './sprint-card/sprint-card.component';
import { SubticketModalComponent } from '../../shared/components/subticket-modal/subticket-modal.component';
import { TicketDetailModalComponent } from '../../shared/components/ticket-detail-modal/ticket-detail-modal.component';
import { Ticket } from '../projects/ticket-card/ticket-card.component';
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
    SprintModalComponent,
    CompleteSprintModalComponent,
    CreateTicketModalComponent,
    SprintCardComponent,
    SubticketModalComponent,
    TicketDetailModalComponent,
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

  /** Ticket à ouvrir dès que le backlog sera chargé (arrivée avec ?ticket= avant la fin du chargement). */
  private pendingOpenTicketId: number | null = null;

  // Data
  backlogData = signal<BacklogResponse | null>(null);
  loading = signal(false);
  error = signal('');
  noProjectAccess = signal(false);

  // Refresh
  refreshing = signal(false);

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
    private ticketNavigation: TicketNavigationService,
    private destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    // Notification cliquée alors que cette page est déjà affichée : ouvrir le ticket sans recharger.
    this.ticketNavigation.openTicket$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((ticketId) => this.openTicketFromNotification(ticketId));

    // Arrivée sur la page (ou re-navigation pendant qu'elle est active) avec ?ticket={id}.
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const raw = params['ticket'];
        const ticketId = raw != null && /^\d+$/.test(String(raw)) ? Number(raw) : null;
        if (ticketId == null) return;
        this.openTicketFromNotification(ticketId);
      });

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.projectId = parseInt(idParam, 10);
      this.projectName = `Project #${this.projectId}`;
      // Mémorise le projet sélectionné pour le menu (Backlog / Tickets).
      this.projectState.setProject(this.projectId);
      this.loadBacklog();
      this.loadUserRole();

      // Polling toutes les 60s : rafraîchit le statut des sprints (démarrage
      // automatique côté backend) sans toast de succès ni rechargement visuel.
      interval(60000)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          switchMap(() => {
            this.loadBacklogInternal(true);
            return [];
          })
        )
        .subscribe();
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
    this.loadBacklogInternal(false);
  }

  /** Recharge le backlog. Si silent=true (polling), n'affiche pas de toast de succès. */
  private loadBacklogInternal(silent: boolean): void {
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
          if (!silent) {
            this.notification.success('Backlog chargé avec succès.');
          }
          if (this.pendingOpenTicketId != null) {
            const ticketId = this.pendingOpenTicketId;
            this.pendingOpenTicketId = null;
            this.openTicketFromNotification(ticketId);
          }
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

  getConnectedDropListIds(): string[] {
    const ids: string[] = [];
    if (this.backlogData()?.sprints) {
      for (const sprint of this.backlogData()!.sprints) {
        ids.push(`sprint-${sprint.id}`);
      }
    }
    return ids;
  }

  /** Drag & Drop inter-sprint : déplacer un ticket d'un sprint vers un autre. */
  onTicketDrop(event: CdkDragDrop<BacklogTicket[]>, targetSprintId: number): void {
    if (event.previousContainer === event.container) return;

    const movedTicket = event.previousContainer.data[event.previousIndex];
    const previousSprintId = movedTicket.sprintId ?? null;

    // Optimistic UI : déplacement immédiat dans la liste cible.
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
    movedTicket.sprintId = targetSprintId;

    this.notification.loading('Déplacement du ticket…');
    this.ticketService.updateTicketSprint(movedTicket.id, targetSprintId)
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
          // Recharger pour restaurer l'état serveur.
          this.loadBacklog();
          if (err.status === 409) {
            this.notification.error(err.error?.message || 'Ce ticket ne peut plus être déplacé : échéance dans ≤ 30 minutes.');
          } else {
            this.notification.error('Échec du déplacement du ticket.');
          }
        }
      });
  }

  /** Terminer un sprint (Admin) : ouvre la modale de clôture. */
  onSprintAction(data: { sprintId: number; action: 'complete' }): void {
    if (data.action === 'complete') {
      this.openCompleteSprintModal(data.sprintId);
    }
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

  /**
   * Ouvre le ticket demandé par une notification (queryParam ?ticket= ou clic
   * sur la page courante). Si le ticket n'est pas dans les données déjà en
   * mémoire, fallback GET /api/Tickets/{id} : TicketDetail étend SprintTicket,
   * et le modal refait de toute façon un GET complet via loadDetail().
   */
  private openTicketFromNotification(ticketId: number): void {
    if (!this.backlogData()) {
      // Backlog pas encore chargé : on retente dès la fin du chargement initial.
      this.pendingOpenTicketId = ticketId;
      return;
    }
    const found = [
      ...(this.backlogData()?.backlogTickets || []),
      ...(this.backlogData()?.sprints || []).flatMap(s => s.tickets || [])
    ].some(t => t.id === ticketId);
    if (found) {
      this.openTicketDetail(ticketId);
      return;
    }
    this.ticketService.getTicket(ticketId).subscribe({
      next: (detail) => this.ticketDetailModal.open(detail),
      error: () => this.notification.error('Impossible de charger le ticket demandé.')
    });
  }

  // ==================== ASSIGNATION TICKET ====================
  /** Ouvre le modal d'assignation depuis la zone avatar/nom d'une carte ticket. */
  openAssignTicketModal(ticket: Ticket): void {
    this.assignTicketModal.open(ticket.id, ticket.title);
  }

  onTicketAssigned(): void {
    this.loadBacklog();
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