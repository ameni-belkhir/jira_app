import {
  Component,
  inject,
  Input,
  Output,
  EventEmitter,
  DestroyRef,
  signal,
  computed,
  ElementRef,
  ViewChild,
  afterNextRender,
  EnvironmentInjector,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import flatpickr from 'flatpickr';
import { French } from 'flatpickr/dist/l10n/fr.js';

import {
  SprintTicket,
  SubTicket,
  UpdateTicketRequest,
  TicketDetail,
  TicketService,
} from '../../../services/ticket.service';
import { CommentService, TicketComment } from '../../../services/comment.service';
import { ProjectService } from '../../../services/project.service';
import { ProjectMembersService, ProjectMemberWithEmail } from '../../../services/project-members.service';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { SafeImagePipe } from '../../pipe/safe-image.pipe';

interface StatusOption {
  value: string;
  label: string;
  classes: string;
}

interface PriorityOption {
  value: string;
  label: string;
  emoji: string;
  classes: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'A_FAIRE', label: 'À faire', classes: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  { value: 'EN_COURS', label: 'En cours', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'TERMINE', label: 'Fait', classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
];

const PRIORITY_OPTIONS: PriorityOption[] = [
  { value: 'BAS', label: 'Basse', emoji: '🟢', classes: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'MOYENNE', label: 'Moyenne', emoji: '🟡', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'HAUTE', label: 'Haute', emoji: '🔴', classes: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'CRITIQUE', label: 'Urgente', emoji: '⚡', classes: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400' },
];

const LABEL_PRESETS = ['Bug', 'Feature', 'Backend', 'UI/UX', 'Urgent', 'Documentation'];

@Component({
  selector: 'app-ticket-detail-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeImagePipe],
  templateUrl: './ticket-detail-modal.component.html',
  styles: ``,
})
export class TicketDetailModalComponent {
  @Input() projectId: number = 0;
  @Input() sprintId: number | null = null;
  @Input() canEditTicket: boolean = false;
  @Input() canAssignTicket: boolean = false;
  @Input() isAdmin: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() changed = new EventEmitter<void>();
  @Output() deleted = new EventEmitter<void>();

  private ticketService = inject(TicketService);
  private commentService = inject(CommentService);
  private projectService = inject(ProjectService);
  private projectMembersService = inject(ProjectMembersService);
  private authService = inject(AuthService);
  private notification = inject(NotificationService);
  private destroyRef = inject(DestroyRef);
  private injector = inject(EnvironmentInjector);

  readonly statusOptions = STATUS_OPTIONS;
  readonly priorityOptions = PRIORITY_OPTIONS;
  readonly labelPresets = LABEL_PRESETS;

  isOpen = signal(false);
  closing = signal(false);
  error = signal('');

  currentTicket = signal<SprintTicket | null>(null);
  detail = signal<TicketDetail | null>(null);

  title = signal('');
  titleEditing = signal(false);
  description = signal('');
  descriptionEditing = signal(false);
  status = signal<string>('A_FAIRE');
  priority = signal<string>('MOYENNE');
  assigneeId = signal<number | null>(null);
  dueDate = signal('');
  labels = signal<string[]>([]);

  projectName = signal('');
  sprintName = signal('');

  subtasks = signal<SubTicket[]>([]);
  newSubtaskTitle = '';
  addingSubtask = signal(false);

  comments = signal<TicketComment[]>([]);
  newComment = '';
  sendingComment = signal(false);
  editingCommentId = signal<number | string | null>(null);
  editingCommentText = '';

  confirmingDelete = signal(false);
  deleting = signal(false);

  members = signal<ProjectMemberWithEmail[]>([]);
  currentUserName = this.authService.getEmail() || 'Moi';
  private currentUserId = Number(this.authService.getUserId() || 0);

  @ViewChild('duePicker') duePickerRef!: ElementRef<HTMLInputElement>;
  private flatpickrDue: flatpickr.Instance | null = null;

  /** Changer le statut : Admin, ScrumMaster, Senior, ou Developer sur son propre ticket. */
  canChangeStatus = computed(() =>
    this.canEditTicket || this.canAssignTicket || (this.assigneeId() !== null && this.assigneeId() === this.currentUserId)
  );

  completedSubtasks = computed(() =>
    this.subtasks().filter((s) => (s.status || '').toUpperCase() === 'TERMINE').length
  );
  progressPercent = computed(() => {
    const total = this.subtasks().length;
    if (!total) return 0;
    return Math.round((this.completedSubtasks() / total) * 100);
  });
  sortedComments = computed(() =>
    [...this.comments()].sort(
      (a, b) => new Date(a.dateCreation ?? 0).getTime() - new Date(b.dateCreation ?? 0).getTime()
    )
  );
  assigneeMember = computed<ProjectMemberWithEmail | null>(() => {
    const id = this.assigneeId();
    if (id == null) return null;
    return this.members().find((m) => m.userId === id) ?? null;
  });

  /** Sauvegarde différée (debounce) des champs texte (titre / description). */
  private persist$ = new Subject<Partial<UpdateTicketRequest>>();

  constructor() {
    this.persist$
      .pipe(debounceTime(600), takeUntilDestroyed(this.destroyRef))
      .subscribe((patch) => this.persist(patch, undefined, true));
  }

  open(ticket: SprintTicket): void {
    this.currentTicket.set(ticket);
    this.detail.set(null);
    this.title.set(ticket.title || '');
    this.description.set(ticket.description || '');
    this.status.set(this.normalizeStatus(ticket.status));
    this.priority.set(this.normalizePriority(ticket.priority));
    this.assigneeId.set(null);
    this.dueDate.set('');
    this.labels.set([]);
    this.subtasks.set([]);
    this.comments.set([]);
    this.members.set([]);
    this.error.set('');
    this.confirmingDelete.set(false);
    this.titleEditing.set(false);
    this.descriptionEditing.set(false);
    this.closing.set(false);
    this.isOpen.set(true);
    this.loadDetail();
    this.loadSubtasks();
    this.loadComments();
    this.loadMembers();
    this.loadContext();
    afterNextRender(() => this.initFlatpickrDue(), { injector: this.injector });
  }

  closeModal(): void {
    if (this.closing()) return;
    this.closing.set(true);
    this.destroyFlatpickrDue();
    setTimeout(() => {
      this.isOpen.set(false);
      this.closing.set(false);
      this.close.emit();
    }, 180);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('ticket-modal-backdrop')) {
      this.closeModal();
    }
  }

  // ==================== CHARGEMENT ====================

  private loadDetail(): void {
    const id = this.currentTicket()?.id;
    if (!id) return;
    this.ticketService
      .getTicket(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.detail.set(d);
          this.title.set(d.title);
          this.description.set(d.description || '');
          this.status.set(this.normalizeStatus(d.status));
          this.priority.set(this.normalizePriority(d.priority));
          this.assigneeId.set(d.assigneeId ?? null);
          this.dueDate.set(d.dateEcheance ? this.toLocalInputValue(d.dateEcheance) : '');
          if (d.projectId) this.projectId = d.projectId;
          if (d.sprintId != null) this.sprintId = d.sprintId;

          afterNextRender(() => {
            if (this.flatpickrDue && d.dateEcheance) {
              this.flatpickrDue.setDate(d.dateEcheance, false);
            }
          }, { injector: this.injector });
        },
        error: () => {
          this.error.set('Impossible de charger le détail du ticket.');
        },
      });
  }

  private loadSubtasks(): void {
    const id = this.currentTicket()?.id;
    if (!id) return;
    this.ticketService
      .getSubtickets(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => this.subtasks.set(items || []),
        error: () => this.subtasks.set([]),
      });
  }

  private loadComments(): void {
    const id = this.currentTicket()?.id;
    if (!id) return;
    this.commentService
      .getComments(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => this.comments.set(items || []),
        error: () => this.comments.set([]),
      });
  }

  private loadMembers(): void {
    if (!this.projectId) return;
    this.projectMembersService
      .getProjectMembers(this.projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => this.members.set(items || []),
        error: () => this.members.set([]),
      });
  }

  private loadContext(): void {
    if (this.projectId) {
      this.projectService
        .getProject(this.projectId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (p) => this.projectName.set(p.nom),
          error: () => {},
        });
    }
    if (this.projectId && this.sprintId != null) {
      this.projectService
        .getSprints(this.projectId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (sprints) => {
            const s = sprints.find((x) => x.id === this.sprintId);
            if (s) this.sprintName.set(s.name);
          },
          error: () => {},
        });
    }
  }

  // ==================== TITRE ====================

  startTitleEdit(): void {
    if (!this.canEditTicket) return;
    this.titleEditing.set(true);
  }

  onTitleSave(): void {
    this.titleEditing.set(false);
    const value = this.title().trim();
    if (!value) {
      this.title.set(this.currentTicket()?.title || '');
      return;
    }
    this.persist$.next({ titre: value });
  }

  onTitleKeydown(event: Event): void {
    const key = (event as KeyboardEvent).key;
    if (key === 'Enter') {
      event.preventDefault();
      this.onTitleSave();
    } else if (key === 'Escape') {
      this.titleEditing.set(false);
      this.title.set(this.currentTicket()?.title || '');
    }
  }

  // ==================== DESCRIPTION ====================

  startDescriptionEdit(): void {
    if (!this.canEditTicket) return;
    this.descriptionEditing.set(true);
  }

  onSaveDescription(): void {
    this.descriptionEditing.set(false);
    this.persist$.next({ description: this.description() || null });
  }

  onCancelDescription(): void {
    this.descriptionEditing.set(false);
    this.description.set(this.detail()?.description ?? this.currentTicket()?.description ?? '');
  }

  // ==================== CHAMPS GÉNÉRIQUES ====================

  setStatus(value: string): void {
    if (!this.canChangeStatus()) return;
    const id = this.currentTicket()?.id;
    if (!id) return;
    const current = this.status();
    if (!TicketDetailModalComponent.isValidTransition(current, value)) return;
    const previous = this.status();
    this.status.set(value);
    this.ticketService
      .updateStatus(id, value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notification.success('Statut mis à jour.');
          this.changed.emit();
        },
        error: () => {
          this.status.set(previous);
          this.notification.error('Échec de la mise à jour du statut.');
        },
      });
  }

  setPriority(value: string): void {
    if (!this.canEditTicket) return;
    const previous = this.priority();
    this.priority.set(value);
    this.persist({ priority: value }, () => this.priority.set(previous));
  }

  setAssignee(userId: string): void {
    if (!this.canAssignTicket) return;
    const id = this.currentTicket()?.id;
    if (!id) return;
    const newId = userId ? Number(userId) : null;
    const previous = this.assigneeId();
    this.assigneeId.set(newId);
    this.ticketService
      .updateTicketAssignee(id, newId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notification.success('Ticket assigné.');
          this.changed.emit();
        },
        error: () => {
          this.assigneeId.set(previous);
          this.notification.error('Échec de l\'assignation du ticket.');
        },
      });
  }

  onDueDateChange(value: string): void {
    this.dueDate.set(value);
    const isoValue = value ? this.toIsoDate(value) : null;
    this.persist({ dateEcheance: isoValue });
  }

  private toIsoDate(dateStr: string): string | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  /**
   * Convertit une date ISO UTC du backend (ex: "2026-08-21T14:30:00Z") en
   * valeur locale "Y-m-dTH:i" affichable par flatpickr. On convertit
   * explicitement vers l'heure locale au lieu de tronquer la string UTC
   * (comme si elle était locale), ce qui causait un drift de fuseau horaire
   * à la ré-sauvegarde : toIsoDate() repasse ensuite de local vers UTC.
   */
  private toLocalInputValue(isoUtc: string): string {
    if (!isoUtc) return '';
    const d = new Date(isoUtc);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ==================== FLATPICKR DATE/TIME PICKER ====================

  private initFlatpickrDue(): void {
    this.destroyFlatpickrDue();
    if (!this.duePickerRef?.nativeElement) return;

    this.flatpickrDue = flatpickr(this.duePickerRef.nativeElement, {
      enableTime: true,
      dateFormat: 'Y-m-dTH:i',
      time_24hr: true,
      locale: French,
      altInput: true,
      altFormat: 'd/m/Y \\à H:i',
      disableMobile: true,
      defaultDate: this.dueDate() || undefined,
      onChange: (_selectedDates, dateStr) => {
        this.dueDate.set(dateStr);
        const isoValue = dateStr ? this.toIsoDate(dateStr) : null;
        this.persist({ dateEcheance: isoValue });
      }
    });
  }

  private destroyFlatpickrDue(): void {
    this.flatpickrDue?.destroy();
    this.flatpickrDue = null;
  }

  toggleLabel(label: string): void {
    const current = this.labels();
    this.labels.set(
      current.includes(label) ? current.filter((l) => l !== label) : [...current, label]
    );
    this.changed.emit();
  }

  /** Sauvegarde automatique (debounce pour le texte, immédiate pour les sélecteurs). */
  onUpdateField(patch: Partial<UpdateTicketRequest>): void {
    this.persist(patch);
  }

  private persist(patch: Partial<UpdateTicketRequest>, revert?: () => void, silent = false): void {
    const id = this.currentTicket()?.id;
    if (!id) return;
    const payload: UpdateTicketRequest = { ...this.buildPayload(), ...patch };
    console.log('[TicketDetailModal] persist → PUT /api/Tickets/' + id, JSON.stringify(payload));
    this.ticketService
      .updateTicket(id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (!silent) this.notification.success('Ticket mis à jour.');
          this.changed.emit();
        },
        error: () => {
          if (revert) revert();
          if (!silent) this.notification.error('Échec de la mise à jour du ticket.');
        },
      });
  }

  private buildPayload(): UpdateTicketRequest {
    const ticket = this.currentTicket();
    const d = this.detail();
    return {
      id: ticket?.id ?? 0,
      titre: this.title(),
      description: this.description() || null,
      creatorId: d?.creatorId ?? 0,
      projectId: this.projectId || (d?.projectId ?? null),
      sprintId: this.sprintId ?? (d?.sprintId ?? null),
      status: this.status(),
      priority: this.priority(),
      color: d?.color || ticket?.color || '#3b82f6',
      dateEcheance: this.toIsoDate(this.dueDate()) ?? null,
    };
  }

  // ==================== SOUS-TÂCHES ====================

  onToggleSubtask(subtask: SubTicket): void {
    const done = (subtask.status || '').toUpperCase() === 'TERMINE';
    const newStatus = done ? 'A_FAIRE' : 'TERMINE';
    const previous = subtask.status;
    subtask.status = newStatus;
    this.subtasks.set([...this.subtasks()]);
    this.ticketService
      .updateStatus(subtask.id, newStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notification.success(done ? 'Sous-tâche réouverte.' : 'Sous-tâche terminée.');
          this.changed.emit();
        },
        error: () => {
          subtask.status = previous;
          this.subtasks.set([...this.subtasks()]);
          this.notification.error('Impossible de mettre à jour la sous-tâche.');
        },
      });
  }

  onDeleteSubtask(subtask: SubTicket): void {
    this.ticketService
      .deleteTicket(subtask.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.subtasks.set(this.subtasks().filter((s) => s.id !== subtask.id));
          this.notification.success('Sous-tâche supprimée.');
          this.changed.emit();
        },
        error: () => {
          this.notification.error('Échec de la suppression de la sous-tâche.');
        },
      });
  }

  onAddSubtask(): void {
    const titre = this.newSubtaskTitle.trim();
    const id = this.currentTicket()?.id;
    if (!titre || !id || this.addingSubtask()) return;
    this.addingSubtask.set(true);
    this.ticketService
      .createSubTicket(id, { titre, priority: 'MOYENNE', assigneeId: null, color: '#3b82f6' })
      .pipe(
        finalize(() => this.addingSubtask.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.newSubtaskTitle = '';
          this.notification.success('Sous-tâche ajoutée.');
          this.loadSubtasks();
          this.changed.emit();
        },
        error: () => {
          this.notification.error('Échec de l\'ajout de la sous-tâche.');
        },
      });
  }

  // ==================== COMMENTAIRES ====================

  onAddComment(): void {
    const message = this.newComment.trim();
    const id = this.currentTicket()?.id;
    if (!message || !id || this.sendingComment()) return;
    this.sendingComment.set(true);
    this.commentService
      .addComment({ ticketId: id, contenu: message, authorId: this.currentUserId })
      .pipe(
        finalize(() => this.sendingComment.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.newComment = '';
          this.notification.success('Commentaire ajouté.');
          // Recharge depuis le serveur pour garantir la cohérence.
          this.loadComments();
        },
        error: () => {
          this.notification.error('Échec de l\'envoi du commentaire.');
        },
      });
  }

  startEditComment(comment: TicketComment): void {
    this.editingCommentId.set(comment.id);
    this.editingCommentText = comment.contenu;
  }

  onSaveComment(comment: TicketComment): void {
    const message = this.editingCommentText.trim();
    if (!message) return;
    const ticketId = this.currentTicket()?.id ?? 0;
    this.commentService
      .updateComment(comment.id, {
        id: comment.id,
        ticketId,
        contenu: message,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          comment.contenu = message;
          this.comments.set([...this.comments()]);
          this.editingCommentId.set(null);
          this.notification.success('Commentaire modifié.');
        },
        error: () => {
          this.notification.error('Échec de la modification du commentaire.');
        },
      });
  }

  onCancelCommentEdit(): void {
    this.editingCommentId.set(null);
  }

  onDeleteComment(comment: TicketComment): void {
    this.commentService
      .deleteComment(comment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.comments.set(this.comments().filter((c) => c.id !== comment.id));
          this.notification.success('Commentaire supprimé.');
        },
        error: () => {
          this.notification.error('Échec de la suppression du commentaire.');
        },
      });
  }

  // ==================== SUPPRESSION (ADMIN) ====================

  onDeleteTicket(): void {
    const id = this.currentTicket()?.id;
    if (!id || this.deleting()) return;
    this.deleting.set(true);
    this.ticketService
      .deleteTicket(id)
      .pipe(
        finalize(() => this.deleting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.notification.success('Ticket supprimé définitivement.');
          this.deleted.emit();
          this.closeModal();
        },
        error: () => {
          this.notification.error('Échec de la suppression du ticket.');
        },
      });
  }

  // ==================== HELPERS AFFICHAGE ====================

  statusInfo(value: string): StatusOption {
    return STATUS_OPTIONS.find((o) => o.value === value) ?? STATUS_OPTIONS[0];
  }

  priorityInfo(value: string): PriorityOption {
    return PRIORITY_OPTIONS.find((o) => o.value === value) ?? PRIORITY_OPTIONS[1];
  }

  isSubtaskDone(subtask: SubTicket): boolean {
    return (subtask.status || '').toUpperCase() === 'TERMINE';
  }

  memberFullName(member: ProjectMemberWithEmail | null): string {
    return member ? `${member.prenom} ${member.nom}` : 'Non assigné';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  initials(name?: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }

  private normalizeStatus(value?: string): string {
    const s = (value || '').toUpperCase();
    if (s.includes('EN_COURS') || s.includes('IN_PROGRESS') || s.includes('DOING')) return 'EN_COURS';
    if (s.includes('TERMINE') || s.includes('DONE') || s.includes('FAIT') || s.includes('COMPLETED')) return 'TERMINE';
    return 'A_FAIRE';
  }

  private normalizePriority(value?: string): string {
    const s = (value || '').toUpperCase();
    if (s === 'BAS' || s === 'LOW') return 'BAS';
    if (s === 'HAUTE' || s === 'HIGH') return 'HAUTE';
    if (s === 'CRITIQUE' || s === 'CRITICAL' || s === 'URGENT') return 'CRITIQUE';
    return 'MOYENNE';
  }

  private static isValidTransition(from: string, to: string): boolean {
    return (from === 'A_FAIRE' && to === 'EN_COURS')
        || (from === 'EN_COURS' && to === 'TERMINE');
  }
}
