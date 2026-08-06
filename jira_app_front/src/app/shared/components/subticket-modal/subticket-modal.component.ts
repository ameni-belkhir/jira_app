import { Component, Input, Output, EventEmitter, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { SubTicket, TicketService } from '../../../services/ticket.service';
import { ProjectService, CreateTicketRequest } from '../../../services/project.service';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../shared/services/notification.service';

@Component({
  selector: 'app-subticket-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subticket-modal.component.html',
  styles: ``
})
export class SubticketModalComponent {
  @Input() canManageTickets: boolean = false;
  @Input() projectId: number = 0;
  @Input() creatorId: string = '';
  @Output() close = new EventEmitter<void>();
  @Output() subticketCreated = new EventEmitter<void>();

  @ViewChild('subTicketForm') subTicketForm!: NgForm;

  isOpen = signal(false);
  loading = signal(false);
  error = signal('');
  subtickets = signal<SubTicket[]>([]);

  private currentTicketId = 0;

  // New sub-ticket form
  showCreateForm = signal(false);
  newTitle = '';
  newDescription = '';
  newPriority = 'Medium';
  submitted = false;
  creating = signal(false);

  constructor(
    private ticketService: TicketService,
    private projectService: ProjectService,
    private notification: NotificationService
  ) {}

  open(ticketId: number): void {
    this.currentTicketId = ticketId;
    this.isOpen.set(true);
    this.subtickets.set([]);
    this.error.set('');
    this.showCreateForm.set(false);
    this.loadSubtickets();
  }

  setLoading(val: boolean): void {
    this.loading.set(val);
  }

  setError(msg: string): void {
    this.error.set(msg);
  }

  closeModal(): void {
    this.isOpen.set(false);
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.closeModal();
    }
  }

  private loadSubtickets(): void {
    this.loading.set(true);
    this.error.set('');

    this.ticketService.getSubtickets(this.currentTicketId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (tickets) => {
          this.subtickets.set(tickets);
        },
        error: () => {
          this.error.set('Échec du chargement des sous-tickets.');
        }
      });
  }

  toggleCreateForm(): void {
    this.showCreateForm.update(v => !v);
    if (!this.showCreateForm()) {
      this.resetForm();
    }
  }

  private mapPriorityToBackend(priority: string): string {
    const map: Record<string, string> = {
      'Low': 'BAS',
      'Medium': 'MOYENNE',
      'High': 'HAUTE',
      'Critical': 'CRITIQUE'
    };
    return map[priority] || 'MOYENNE';
  }

  onCreateSubTicket(): void {
    this.submitted = true;
    if (this.subTicketForm && this.subTicketForm.invalid) return;

    const titre = this.newTitle.trim();
    if (!titre) return;

    this.creating.set(true);
    this.notification.loading('Création du sous-ticket…');

    const payload: CreateTicketRequest = {
      titre,
      description: this.newDescription.trim() || null,
      priority: this.mapPriorityToBackend(this.newPriority),
      projectId: this.projectId,
      creatorId: Number(this.creatorId),
      parentTicketId: this.currentTicketId,
      sprintId: null,
      color: undefined
    };

    this.projectService.createTicket(payload)
      .pipe(finalize(() => {
        this.creating.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: () => {
          this.notification.success('Sous-ticket créé avec succès.');
          this.resetForm();
          this.showCreateForm.set(false);
          this.loadSubtickets();
          this.subticketCreated.emit();
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.error?.message || err.error?.title || 'Erreur lors de la création du sous-ticket.';
          this.error.set(msg);
          this.notification.error(msg);
        }
      });
  }

  private resetForm(): void {
    this.newTitle = '';
    this.newDescription = '';
    this.newPriority = 'Medium';
    this.submitted = false;
    this.subTicketForm?.resetForm();
  }

  getStatusClass(status: string): string {
    const s = status?.toUpperCase() || '';
    if (s === 'EN_COURS' || s === 'IN_PROGRESS') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (s === 'TERMINE' || s === 'DONE' || s === 'FAIT' || s === 'COMPLETED') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }

  getStatusLabel(status: string): string {
    const s = status?.toUpperCase() || '';
    if (s === 'A_FAIRE' || s === 'TODO') return 'À faire';
    if (s === 'EN_COURS' || s === 'IN_PROGRESS') return 'En cours';
    if (s === 'TERMINE' || s === 'DONE' || s === 'FAIT') return 'Fait';
    return s;
  }
}

