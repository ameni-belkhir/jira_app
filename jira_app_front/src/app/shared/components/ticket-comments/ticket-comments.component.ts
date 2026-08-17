import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

import { CommentService, TicketComment, CreateCommentRequest } from '../../../services/comment.service';
import { SignalRService } from '../../../services/signalr.service';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../shared/services/notification.service';
import { SafeImagePipe } from '../../../shared/pipe/safe-image.pipe';

@Component({
  selector: 'app-ticket-comments',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeImagePipe],
  templateUrl: './ticket-comments.component.html',
  styles: ``,
})
export class TicketCommentsComponent implements OnInit, OnDestroy, AfterViewChecked {
  /** The ticket whose comments are displayed. */
  @Input({ required: true }) ticketId!: number;
  /** Project id (used for navigation context if needed). */
  @Input() projectId: number = 0;
  /** Whether the current user can post comments. */
  @Input() canComment: boolean = true;

  @ViewChild('commentsScroll') commentsScroll!: ElementRef;

  // State
  comments = signal<TicketComment[]>([]);
  loading = signal(false);
  sending = signal(false);
  error = signal('');
  newMessage = '';

  /** Current user info */
  currentUserName = signal<string>('');
  currentUserRole = signal<string>('');
  private currentUserId = 0;

  /** Sorted list: newest first. */
  sortedComments = computed(() =>
    [...this.comments()].sort((a, b) =>
      new Date(b.dateCreation ?? 0).getTime() - new Date(a.dateCreation ?? 0).getTime()
    )
  );

  private subscriptions = new Subscription();
  private scrollShouldBottom = false;

  constructor(
    private commentService: CommentService,
    private signalR: SignalRService,
    private authService: AuthService,
    private notification: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadComments();

    // Subscribe to real-time ticket comments broadcast via SignalR.
    this.subscriptions.add(
      this.signalR.ticketComment$.subscribe((comment) => {
        this.handleRealtimeComment(comment);
      })
    );

    this.currentUserName.set(this.authService.getEmail() || 'Moi');
    this.currentUserRole.set(this.authService.getRole() || '');
    this.currentUserId = Number(this.authService.getUserId() || 0);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  ngAfterViewChecked(): void {
    if (this.scrollShouldBottom && this.commentsScroll) {
      const el = this.commentsScroll.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.scrollShouldBottom = false;
    }
  }

  /** Load comment history via GET /api/Commentaires?ticketId=... */
  loadComments(): void {
    this.loading.set(true);
    this.error.set('');

    this.commentService.getComments(this.ticketId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => {
          this.comments.set(data || []);
          this.scrollShouldBottom = true;
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 0
            ? 'Impossible de se connecter au serveur.'
            : err.status === 404
              ? 'Aucun commentaire.'
              : 'Échec du chargement des commentaires.';
          this.error.set(msg);
        }
      });
  }

  /**
   * Handle a comment received in real-time via SignalR.
   * Only append if it belongs to the currently displayed ticket.
   */
  private handleRealtimeComment(comment: TicketComment): void {
    if (!comment) return;

    const c = {
      ...comment,
      ticketId: comment.ticketId ?? this.ticketId,
      dateCreation: comment.dateCreation ?? new Date().toISOString(),
      authorName: comment.authorName || 'Membre',
    };

    // Only display comments for the active ticket.
    if (c.ticketId !== this.ticketId) return;

    const current = this.comments();
    const exists = current.some((existing) => existing.id === c.id);
    if (!exists) {
      this.comments.set([...current, c]);
      this.scrollShouldBottom = true;
      this.notification.validation(
        `${c.authorName} a commenté le ticket`
      );
    }
  }

  /** Send a new comment via POST /api/Commentaires. */
  sendComment(): void {
    const message = this.newMessage.trim();
    if (!message) return;

    this.sending.set(true);
    this.error.set('');

    const payload: CreateCommentRequest = {
      ticketId: this.ticketId,
      contenu: message,
      authorId: this.currentUserId,
    };

    this.commentService.addComment(payload)
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe({
        next: () => {
          this.newMessage = '';
          this.notification.success('Commentaire envoyé.');
          // Recharge depuis le serveur pour garantir la cohérence.
          this.loadComments();
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 0
            ? 'Impossible de se connecter au serveur.'
            : err.error?.message || err.error?.title || 'Échec de l\'envoi du commentaire.';
          this.error.set(msg);
          this.notification.error(msg);
        }
      });
  }

  /** Format a date for display (dd/mm/yyyy hh:mm). */
  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** Role badge styling. */
  roleClass(role?: string): string {
    const r = (role || '').toLowerCase();
    if (r.includes('admin')) return 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400';
    if (r.includes('scrum')) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    if (r.includes('senior')) return 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }

  /** Role label. */
  roleLabel(role?: string): string {
    if (!role) return 'Membre';
    const map: Record<string, string> = {
      Admin: 'Admin',
      ScrumMaster: 'Scrum Master',
      Senior: 'Senior',
      Developer: 'Développeur',
    };
    return map[role] || role;
  }

  /** Initials for the avatar fallback. */
  initials(name?: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
}

