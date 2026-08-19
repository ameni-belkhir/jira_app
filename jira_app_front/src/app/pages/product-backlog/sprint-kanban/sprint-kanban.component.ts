import { Component, Input, OnInit, signal, computed, inject, ViewChild, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  CdkDropListGroup,
  CdkDropList,
  CdkDrag,
  CdkDragHandle,
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TicketService, SprintTicket } from '../../../services/ticket.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { ProjectMembersService, AvailableUser } from '../../../services/project-members.service';
import { TicketCardComponent, Ticket } from '../../projects/ticket-card/ticket-card.component';
import { NotificationService } from '../../../shared/services/notification.service';
import { CreateTicketModalComponent } from '../create-ticket-modal/create-ticket-modal.component';
import { TicketDetailModalComponent } from '../../../shared/components/ticket-detail-modal/ticket-detail-modal.component';
import { SubticketModalComponent } from '../../../shared/components/subticket-modal/subticket-modal.component';
import { AssignTicketModalComponent } from '../../../shared/components/assign-ticket-modal/assign-ticket-modal.component';
import { AuthService } from '../../../services/auth.service';
import { HttpErrorResponse } from '@angular/common/http';
import { CreateTicketRequest, ProjectService } from '../../../services/project.service';
import { finalize } from 'rxjs';

/** Colonne du Kanban (structure Trello). */
export interface KanbanColumn {
  id: string;
  name: string;
  tickets: SprintTicket[];
}

/** Thème / fond d'écran du tableau. */
export interface BoardTheme {
  name: string;
  category: 'gradient' | 'image' | 'color';
  bg: string;
}

@Component({
  selector: 'app-sprint-kanban',
  standalone: true,
  imports: [CommonModule, FormsModule, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragHandle, TicketCardComponent, CreateTicketModalComponent, SubticketModalComponent, TicketDetailModalComponent, AssignTicketModalComponent],
  templateUrl: './sprint-kanban.component.html',
  styleUrls: ['./sprint-kanban.component.css']
})
export class SprintKanbanComponent implements OnInit {
  @Input({ required: true }) sprintId!: number;
  @Input({ required: true }) projectId!: number;
  @ViewChild(CreateTicketModalComponent) createTicketModal!: CreateTicketModalComponent;
  @ViewChild(SubticketModalComponent) subticketModal!: SubticketModalComponent;
  @ViewChild(TicketDetailModalComponent) ticketDetailModal!: TicketDetailModalComponent;
  @ViewChild(AssignTicketModalComponent) assignTicketModal!: AssignTicketModalComponent;

  aFaire = signal<SprintTicket[]>([]);
  enCours = signal<SprintTicket[]>([]);
  fait = signal<SprintTicket[]>([]);

  loading = signal(false);
  error = signal('');
  userRole = signal<string | null>(null);
  noProjectAccess = signal(false);

  private notification = inject(NotificationService);
  private destroyRef = inject(DestroyRef);
  private projectState = inject(ProjectStateService);

  // Assign Developer modal state
  showAssignDeveloperModal = signal(false);
  availableDevelopers = signal<AvailableUser[]>([]);
  loadingDevelopers = signal(false);
  assigningDeveloper = signal(false);

  /** Colonnes du tableau, construites depuis les trois états de ticket. */
  columns = computed<KanbanColumn[]>(() => [
    { id: 'a-faire', name: 'A faire', tickets: this.aFaire() },
    { id: 'en-cours', name: 'En cours', tickets: this.enCours() },
    { id: 'fait', name: 'Fait', tickets: this.fait() },
  ]);

  // ==================== THÈME / FOND DU TABLEAU ====================
  readonly themes: BoardTheme[] = [
    // Gradients
    { name: 'Trello Classic', category: 'gradient', bg: 'linear-gradient(to bottom, #0079bf, #50b0d8)' },
    { name: 'Aqua Pastel', category: 'gradient', bg: 'linear-gradient(135deg, #67e8f9 0%, #22d3ee 50%, #06b6d4 100%)' },
    { name: 'Lavande Pastel', category: 'gradient', bg: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 50%, #8b5cf6 100%)' },
    { name: 'Menthe Pastel', category: 'gradient', bg: 'linear-gradient(135deg, #6ee7b7 0%, #34d399 50%, #10b981 100%)' },
    { name: 'Sunset', category: 'gradient', bg: 'linear-gradient(135deg, #fca5a5 0%, #fb923c 50%, #fbbf24 100%)' },
    // Images Unsplash
    { name: 'Nature', category: 'image', bg: 'url("https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80")' },
    { name: 'Workspace', category: 'image', bg: 'url("https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?auto=format&fit=crop&w=1920&q=80")' },
    { name: 'Abstract', category: 'image', bg: 'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80")' },
    { name: 'Minimal', category: 'image', bg: 'url("https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1920&q=80")' },
    // Couleurs unies
    { name: 'Corail', category: 'color', bg: '#fca5a5' },
    { name: 'Lavande', category: 'color', bg: '#a78bfa' },
    { name: 'Pêche', category: 'color', bg: '#fed7aa' },
  ];

  selectedTheme = signal<string>(this.themes[0].bg);
  showThemePanel = signal(false);

  boardStyle = computed(() => ({
    'background': this.selectedTheme(),
    'background-size': 'cover',
    'background-position': 'center',
    'background-attachment': 'fixed',
  }));

  themesByCategory(category: BoardTheme['category']): BoardTheme[] {
    return this.themes.filter((t) => t.category === category);
  }

  themeCategoryLabel(category: BoardTheme['category']): string {
    switch (category) {
      case 'gradient': return 'Dégradés';
      case 'image': return 'Images';
      case 'color': return 'Couleurs';
    }
  }

  toggleThemePanel(): void {
    this.showThemePanel.set(!this.showThemePanel());
  }

  isSelected(theme: BoardTheme): boolean {
    return this.selectedTheme() === theme.bg;
  }

  changeTheme(theme: BoardTheme): void {
    this.selectedTheme.set(theme.bg);
    localStorage.setItem(`kanban_theme_${this.projectId}`, theme.bg);
    this.showThemePanel.set(false);
  }

  constructor(
    private ticketService: TicketService,
    private projectService: ProjectService,
    private projectMembersService: ProjectMembersService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Mémorise le contexte projet / sprint dans le state global (liens Sidebar).
    this.projectState.setContext(this.projectId, this.sprintId);
    this.loadSavedTheme();
    this.checkAccessAndLoad();
  }

  /** Restaure le fond choisi pour ce projet (localStorage, clé par projet). */
  private loadSavedTheme(): void {
    const saved = localStorage.getItem(`kanban_theme_${this.projectId}`);
    if (saved) {
      this.selectedTheme.set(saved);
    }
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
        // L'Admin global peut accéder à tous les projets sans être membre.
        if (!role.roleInProject && !this.authService.isAdmin()) {
          this.noProjectAccess.set(true);
          return;
        }
        this.loadTickets();
      },
      error: (err) => {
        if (this.authService.isAdmin()) {
          this.loadTickets();
          return;
        }
        if (err?.status === 403) {
          this.noProjectAccess.set(true);
          return;
        }
        this.notification.error('Accès non autorisé à ce projet.');
        this.router.navigate(['/dashboard']);
      }
    });
  }

  /** Créer / éditer tickets, sous-tickets et sprints : Admin + ScrumMaster. */
  get canEditTickets(): boolean {
    return this.authService.isAdmin() || this.userRole() === 'ScrumMaster';
  }

  /** Assigner un Developer / affecter au projet : Admin + ScrumMaster + Senior. */
  get canAssignTickets(): boolean {
    const role = this.userRole();
    return this.authService.isAdmin() || role === 'ScrumMaster' || role === 'Senior';
  }

  /** Rôle de l'appelant pour le filtrage du modal d'assignation (Admin global → bypass complet). */
  get assignCallerRole(): string | null {
    return this.authService.isAdmin() ? 'Admin' : this.userRole();
  }

  /** Changer le statut (DnD) : Admin, ScrumMaster, Senior ou Developer (ses tickets — le backend filtre). */
  get canChangeStatus(): boolean {
    const role = this.userRole();
    return this.authService.isAdmin() || role === 'ScrumMaster' || role === 'Senior' || role === 'Developer';
  }

  /** Bouton de suppression définitive réservé à l'Admin global. */
  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  /** Suppression définitive d'un ticket (avec ses sous-tickets) — Admin uniquement. */
  onDeleteTicket(ticketId: number): void {
    this.notification.loading('Suppression du ticket…');

    this.ticketService.deleteTicket(ticketId)
      .pipe(finalize(() => this.notification.dismiss()))
      .subscribe({
        next: () => {
          this.loadTickets();
          this.notification.success('Ticket supprimé définitivement.');
        },
        error: () => {
          this.notification.error('Échec de la suppression du ticket.');
        }
      });
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
        error: (err: HttpErrorResponse) => {
          if (err.status === 403) {
            this.noProjectAccess.set(true);
            return;
          }
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

  /** Force la ré-émission des signaux des colonnes après mutation des tableaux. */
  private commitColumnSignals(): void {
    this.aFaire.set([...this.aFaire()]);
    this.enCours.set([...this.enCours()]);
    this.fait.set([...this.fait()]);
  }

  /**
   * Drag & drop d'une carte (ticket) entre les colonnes du Kanban.
   * - Même colonne : réorganisation locale via moveItemInArray.
   * - Changement de colonne : transferArrayItem + mise à jour du statut + persistance
   *   backend (updateStatus). Optimistic update : en cas d'échec API, la carte est
   *   réinsérée dans sa colonne d'origine avec une notification d'erreur.
   */
  onTicketDrop(event: CdkDragDrop<SprintTicket[]>, targetColumnId: string): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      this.commitColumnSignals();
      return;
    }

    const movedTicket = event.previousContainer.data[event.previousIndex];
    const previousStatus = movedTicket.status;
    const newStatus = this.getStatusForColumn(targetColumnId);

    if (!SprintKanbanComponent.isValidTransition(previousStatus, newStatus)) {
      return;
    }

    // Optimistic update : déplace la carte localement avant la confirmation backend.
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
    movedTicket.status = newStatus;
    this.commitColumnSignals();

    // Persistance backend (.NET) via PATCH /api/tickets/{id}/status.
    this.ticketService.updateStatus(movedTicket.id, newStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.notification.success('Statut du ticket mis à jour.'),
        error: (err: HttpErrorResponse) => {
          // Rollback : réinsère la carte dans sa colonne d'origine.
          transferArrayItem(
            event.container.data,
            event.previousContainer.data,
            event.currentIndex,
            event.previousIndex
          );
          movedTicket.status = previousStatus;
          this.commitColumnSignals();
          if (err.status === 409) {
            this.notification.error(err.error?.message || 'Ce ticket ne peut plus être déplacé : échéance dans ≤ 30 minutes.');
          } else {
            this.notification.error('Impossible de modifier le statut du ticket');
          }
        }
      });
  }

  // ==================== CRÉATION TICKET ====================
  /** Ouvre le modal de création de ticket (le sprint courant est pré-rempli). */
  openCreateTicketModal(_columnId?: string): void {
    this.createTicketModal.sprintId = this.sprintId;
    this.createTicketModal.open();
  }

  // ==================== SOUS-TICKETS ====================
  openSubticketModal(ticketId: number): void {
    this.subticketModal.open(ticketId);
  }

  /** Ouvre la modale de détail / édition du ticket (style Trello & Jira). */
  openTicketDetail(ticketId: number): void {
    const all = [...this.aFaire(), ...this.enCours(), ...this.fait()];
    const ticket = all.find((t) => t.id === ticketId);
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
    this.loadTickets();
  }

  onCreateSubticketRequested(ticketId: number): void {
    this.subticketModal.open(ticketId);
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
      title: ticket.title || (ticket as any).titre || '',
      priority: (ticket.priority as Ticket['priority']) || 'Medium',
      assignedUser: {
        name: ticket.assignedTo || 'Unassigned',
        avatar: ticket.assignedToAvatar || ''
      },
      dueDate: '',
      labels: [],
      description: ticket.description || '',
      status: 'todo' as Ticket['status'],
      color: ticket.color,
      subTickets: (ticket.subTickets || []).map(sub => this.mapToTicket(sub)),
      isExpanded: false
    };
  }

  private static isValidTransition(from: string, to: string): boolean {
    return (from === 'A_FAIRE' && to === 'EN_COURS')
        || (from === 'EN_COURS' && to === 'TERMINE');
  }

  /** Vérifie si un ticket est verrouillé (échéance dans ≤ 30 minutes ou dépassée). */
  isTicketLocked(ticket: SprintTicket): boolean {
    if (!ticket.dueDate) return false;
    const due = new Date(ticket.dueDate);
    if (isNaN(due.getTime())) return false;
    const now = new Date();
    const threshold = new Date(due.getTime() - 30 * 60 * 1000);
    return now >= threshold;
  }

  /** Vérifie si le drag est désactivé pour un ticket donné. */
  isDragDisabled(ticket: SprintTicket): boolean {
    return !this.canChangeStatus || this.isTicketLocked(ticket);
  }
}
