import { Component, Input, Output, EventEmitter, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { TicketService } from '../../../services/ticket.service';
import { ProjectMembersService, ProjectMemberWithEmail } from '../../../services/project-members.service';
import { NotificationService } from '../../../shared/services/notification.service';

@Component({
  selector: 'app-assign-ticket-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './assign-ticket-modal.component.html',
  styles: ``
})
export class AssignTicketModalComponent {
  @Input({ required: true }) projectId!: number;
  /** Rôle de l'appelant pour le filtrage : 'Admin' → tous, 'ScrumMaster' → Seniors, 'Senior' → Developers. */
  @Input() callerRole: string | null = null;
  @Output() assigned = new EventEmitter<void>();

  visible = signal(false);
  loading = signal(false);
  assigning = signal(false);
  members = signal<ProjectMemberWithEmail[]>([]);
  errorMessage = signal('');

  currentTicketId: number | null = null;
  currentTicketTitle = '';

  private readonly ticketService = inject(TicketService);
  private readonly membersService = inject(ProjectMembersService);
  private readonly notification = inject(NotificationService);

  /** Liste filtrée selon la chaîne hiérarchique : Admin→tous, SM→Seniors, Senior→Developers. */
  assignableMembers = computed(() => {
    const role = this.callerRole;
    const all = this.members();
    if (role === 'Admin') return all;
    if (role === 'ScrumMaster') return all.filter((m) => m.roleInProject === 'Senior');
    if (role === 'Senior') return all.filter((m) => m.roleInProject === 'Developer');
    return [];
  });

  open(ticketId: number, ticketTitle?: string): void {
    this.currentTicketId = ticketId;
    this.currentTicketTitle = ticketTitle ?? '';
    this.errorMessage.set('');
    this.visible.set(true);
    this.loadMembers();
  }

  close(): void {
    this.visible.set(false);
    this.members.set([]);
    this.errorMessage.set('');
  }

  private loadMembers(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.membersService.getProjectMembers(this.projectId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (members) => this.members.set(members),
        error: () => {
          this.members.set([]);
          this.errorMessage.set('Impossible de charger les membres du projet.');
        }
      });
  }

  onAssign(userId: number): void {
    if (this.currentTicketId == null) return;

    this.assigning.set(true);
    this.errorMessage.set('');

    this.ticketService.updateTicketAssignee(this.currentTicketId, userId)
      .pipe(finalize(() => this.assigning.set(false)))
      .subscribe({
        next: () => {
          this.notification.success('Ticket assigné avec succès.');
          this.assigned.emit();
          this.close();
        },
        error: (err: HttpErrorResponse) => {
          // Erreur 400 de la chaîne backend : on affiche le message dans le modal, on ne le ferme pas.
          const msg = err.error?.assigneeId
            || err.error?.AssigneeId
            || err.error?.message
            || 'Échec de l\'assignation du ticket.';
          this.errorMessage.set(msg);
        }
      });
  }
}
