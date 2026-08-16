import { Component, DestroyRef, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, mergeMap, of } from 'rxjs';
import { ProjectService, BacklogSprint, BacklogTicket } from '../../../services/project.service';
import { TicketService } from '../../../services/ticket.service';
import { NotificationService } from '../../../shared/services/notification.service';

@Component({
  selector: 'app-complete-sprint-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './complete-sprint-modal.component.html',
  styles: ``
})
export class CompleteSprintModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() completed = new EventEmitter<void>();

  readonly isOpen = signal(false);
  readonly submitting = signal(false);
  readonly sprint = signal<BacklogSprint | null>(null);
  readonly otherSprints = signal<BacklogSprint[]>([]);

  /** Destination des tickets non terminés : null → Backlog, sinon id d'un autre sprint. */
  selectedDestinationId: number | null = null;

  private readonly projectService = inject(ProjectService);
  private readonly ticketService = inject(TicketService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  get totalCount(): number {
    return this.sprint()?.tickets.length || 0;
  }

  get completedCount(): number {
    return (this.sprint()?.tickets || []).filter(t => this.isDone(t)).length;
  }

  get openCount(): number {
    return (this.sprint()?.tickets || []).filter(t => !this.isDone(t)).length;
  }

  get progressPercent(): number {
    if (this.totalCount === 0) return 0;
    return Math.round((this.completedCount / this.totalCount) * 100);
  }

  /** Ouvre la modale avec le sprint à clôturer et les autres sprints (destinations possibles). */
  open(sprint: BacklogSprint, otherSprints: BacklogSprint[]): void {
    this.sprint.set(sprint);
    this.otherSprints.set(otherSprints);
    this.selectedDestinationId = null;
    this.isOpen.set(true);
  }

  closeModal(): void {
    if (this.submitting()) return;
    this.isOpen.set(false);
    this.close.emit();
  }

  /** Statut considéré comme "terminé" (Fait / Done). */
  private isDone(ticket: BacklogTicket): boolean {
    const s = (ticket.status || '').toLowerCase();
    return s === 'done' || s === 'completed' || s === 'termine' || s === 'terminé' || s === 'fait';
  }

  confirmComplete(): void {
    const current = this.sprint();
    if (!current || this.submitting()) return;

    const openTickets = current.tickets.filter(t => !this.isDone(t));
    const destinationId = this.selectedDestinationId;

    this.submitting.set(true);
    this.notification.loading('Clôture du sprint…');

    // 1) Clôturer le sprint (PUT /api/Sprints/{id})
    // 2) Transférer les tickets non terminés vers la destination choisie
    this.projectService.updateSprint(current.id, { status: 'Completed' })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        mergeMap(() => {
          if (openTickets.length === 0) return of(null);
          return forkJoin(
            openTickets.map(t =>
              this.ticketService.updateTicketSprint(t.id, destinationId).pipe(catchError(() => of(null)))
            )
          );
        }),
        finalize(() => {
          this.submitting.set(false);
          this.notification.dismiss();
        })
      )
      .subscribe({
        next: () => {
          this.notification.success('Sprint clôturé avec succès.');
          this.isOpen.set(false);
          this.completed.emit();
        },
        error: () => {
          this.notification.error('Échec de la clôture du sprint.');
        }
      });
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }
}
