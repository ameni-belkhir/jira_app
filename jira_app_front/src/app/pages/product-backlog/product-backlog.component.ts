import { Component, OnInit, signal, ViewChild, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import { finalize, firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ProjectService, BacklogResponse, BacklogTicket, BacklogSprint, SprintRequest, CreateTicketRequest } from '../../services/project.service';
import { ProjectMembersService, AvailableUser } from '../../services/project-members.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../shared/services/notification.service';
import { CreateSprintModalComponent } from './create-sprint-modal/create-sprint-modal.component';
import { CreateTicketModalComponent } from './create-ticket-modal/create-ticket-modal.component';
import { SprintCardComponent } from './sprint-card/sprint-card.component';
import { SubticketModalComponent } from '../../shared/components/subticket-modal/subticket-modal.component';

@Component({
  selector: 'app-product-backlog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CreateSprintModalComponent,
    CreateTicketModalComponent,
    SprintCardComponent,
    SubticketModalComponent
  ],
  templateUrl: './product-backlog.component.html',
  styles: ``
})
export class ProductBacklogComponent implements OnInit {

  @ViewChild(CreateSprintModalComponent) createSprintModal!: CreateSprintModalComponent;
  @ViewChild(CreateTicketModalComponent) createTicketModal!: CreateTicketModalComponent;
  @ViewChild(SubticketModalComponent) subticketModal!: SubticketModalComponent;

  projectId: number = 0;
  projectName: string = '';

  // Data
  backlogData = signal<BacklogResponse | null>(null);
  loading = signal(false);
  error = signal('');

  // Search
  searchQuery = '';
  filteredUnassignedTickets = signal<BacklogTicket[]>([]);

  // Refresh
  refreshing = signal(false);

  // UI State
  epicsOpen = signal(true);
  sprintExpanded = signal<Record<number, boolean>>({});

  /** Epics computed */
  epics = computed(() => {
    const allTickets = [
      ...(this.backlogData()?.backlogTickets || []),
      ...(this.backlogData()?.sprints || []).flatMap(s => s.tickets || [])
    ];
    const epicMap = new Map<string, { color: string; tickets: BacklogTicket[] }>();
    for (const t of allTickets) {
      const key = t.color || '#6b7280';
      if (!epicMap.has(key)) {
        epicMap.set(key, { color: key, tickets: [] });
      }
      epicMap.get(key)!.tickets.push(t);
    }
    return Array.from(epicMap.values());
  });

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

  // Assign Senior modal state
  showAssignSeniorModal = signal(false);
  availableSeniors = signal<AvailableUser[]>([]);
  loadingSeniors = signal(false);
  assigningSenior = signal(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private projectMembersService: ProjectMembersService,
    private authService: AuthService,
    private notification: NotificationService
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.projectId = parseInt(idParam, 10);
      this.projectName = `Project #${this.projectId}`;
      this.loadBacklog();
      this.loadUserRole();
    }
  }

  private loadUserRole(): void {
    this.projectService.getMyRole(this.projectId).subscribe({
      next: (role) => {
        this.userRole.set(role.roleInProject);
      },
      error: () => {
        this.userRole.set(null);
      }
    });
  }

  /** Whether the current user is a Scrum Master (can assign seniors) */
  get isScrumMaster(): boolean {
    return this.userRole() === 'ScrumMaster';
  }

  /** Whether the current user can manage tickets (ScrumMaster or Senior) */
  get canManageTickets(): boolean {
    const role = this.userRole();
    return role === 'ScrumMaster' || role === 'Senior';
  }

  /** Whether the current user is a Developer */
  get isDeveloper(): boolean {
    return this.userRole() === 'Developer';
  }

  /** Open the "Assign Senior" modal */
  openAssignSeniorModal(): void {
    this.loadingSeniors.set(true);
    this.showAssignSeniorModal.set(true);
    this.notification.loading('Chargement des seniors disponibles…');

    this.projectMembersService.getAvailableSeniors(this.projectId)
      .pipe(finalize(() => {
        this.loadingSeniors.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: (seniors) => {
          this.availableSeniors.set(seniors);
        },
        error: () => {
          this.availableSeniors.set([]);
          this.notification.error('Échec du chargement des seniors disponibles.');
        }
      });
  }

  closeAssignSeniorModal(): void {
    this.showAssignSeniorModal.set(false);
    this.availableSeniors.set([]);
  }

  /** Assign a senior to the project */
  onAssignSenior(userId: number): void {
    this.assigningSenior.set(true);
    this.notification.loading('Affectation du senior…');

    this.projectMembersService.addSeniorToProject(this.projectId, userId)
      .pipe(finalize(() => {
        this.assigningSenior.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: () => {
          this.notification.success('Le senior a été affecté et a reçu un mail de notification.');
          this.closeAssignSeniorModal();
        },
        error: () => {
          this.notification.error('Échec de l\'affectation du senior.');
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
    const backlog = this.backlogData()?.backlogTickets || [];

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
    const ids: string[] = ['backlog-drop-list'];
    if (this.backlogData()?.sprints) {
      for (const sprint of this.backlogData()!.sprints) {
        ids.push(`sprint-${sprint.id}`);
      }
    }
    return ids;
  }

  onBacklogDrop(event: CdkDragDrop<BacklogTicket[]>): void {
    if (event.previousContainer === event.container) return;

    const ticket = event.previousContainer.data[event.previousIndex];
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    this.callMoveTicket(ticket.id, null);
  }

  onTicketDroppedInSprint(data: { ticketId: number; sprintId: number | null }): void {
    this.callMoveTicket(data.ticketId, data.sprintId);
  }

  private callMoveTicket(ticketId: number, sprintId: number | null): void {
    this.notification.loading('Déplacement du ticket…');
    this.projectService.moveTicketToSprint(ticketId, { ticketId, sprintId })
      .pipe(finalize(() => this.notification.dismiss()))
      .subscribe({
        next: () => {
          this.notification.success('Ticket déplacé avec succès.');
          this.loadBacklog();
        },
        error: () => {
          this.notification.error('Échec du déplacement du ticket.');
          this.loadBacklog();
        }
      });
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
    this.router.navigate(['/projects', this.projectId, 'sprint', sprintId, 'kanban']);
  }

  openCreateSprintModal(): void {
    this.createSprintModal.open();
  }

  onCreateSprint(data: SprintRequest): void {
    // Si des Seniors ont été sélectionnés, on les affecte au projet via l'endpoint
    // backend réel POST /projects/{id}/members/senior (le CreateSprint ne stocke pas de Seniors).
    const seniorIds = data.assignedUserIds || [];
    const assignments: Promise<void>[] = seniorIds.map((userId) =>
      firstValueFrom(this.projectMembersService.addSeniorToProject(this.projectId, userId))
    );

    Promise.all(assignments)
      .catch((err) => {
        console.error('Erreur affectation des Seniors au projet:', err);
        this.notification.error('Certains Seniors n\'ont pas pu être affectés au projet.');
      })
      .finally(() => {
        this.notification.loading('Création du sprint…');
        this.projectService.createSprint(data)
          .pipe(finalize(() => this.notification.dismiss()))
          .subscribe({
            next: () => {
              this.loadBacklog();
              this.notification.success('Sprint créé avec succès.');
            },
            error: () => {
              this.notification.error('Échec de la création du sprint.');
            }
          });
      });
  }

  // Helpers
  toggleSprint(sprintId: number): void {
    this.sprintExpanded.update(map => ({
      ...map,
      [sprintId]: !map[sprintId]
    }));
  }

  getStatusCount(sprint: BacklogSprint, ...statuses: string[]): number {
    return sprint.tickets.filter(t =>
      statuses.some(s => t.status?.toLowerCase() === s.toLowerCase())
    ).length;
  }

  getEpicProgress(epic: { color: string; tickets: BacklogTicket[] }): { done: number; total: number } {
    const done = epic.tickets.filter(t =>
      t.status?.toLowerCase() === 'done' || t.status?.toLowerCase() === 'completed' || t.status?.toLowerCase() === 'termine'
    ).length;
    return { done, total: epic.tickets.length };
  }

  getTicketType(ticket: BacklogTicket): { label: string; icon: string } {
    const color = ticket.color || '';
    if (color === '#ef4444') return { label: 'Bug', icon: '🐛' };
    if (color === '#8b5cf6' || color === '#f59e0b') return { label: 'Story', icon: '📖' };
    if (color === '#10b981' || color === '#3b82f6') return { label: 'Task', icon: '✅' };
    return { label: 'Task', icon: '✅' };
  }

  getTicketKey(ticket: BacklogTicket): string {
    return `NUC-${ticket.id}`;
  }

  getTicketLabel(ticket: BacklogTicket): string {
    const color = ticket.color || '';
    const labels: Record<string, string> = {
      '#ef4444': 'URGENT',
      '#f59e0b': 'BILLING',
      '#3b82f6': 'FEEDBACK',
      '#10b981': 'ACCOUNTS',
      '#8b5cf6': 'FEATURE',
    };
    return labels[color] || (ticket.priority?.toUpperCase() || '');
  }

  getLabelClass(color: string | undefined): string {
    const map: Record<string, string> = {
      '#ef4444': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      '#f59e0b': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      '#3b82f6': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      '#10b981': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      '#8b5cf6': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    };
    return map[color || ''] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
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
}