import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, moveItemInArray, transferArrayItem, CdkDropList, CdkDrag } from '@angular/cdk/drag-drop';
import { TicketService, SprintTicket } from '../../../services/ticket.service';
import { TicketCardComponent, Ticket } from '../../projects/ticket-card/ticket-card.component';
import { NotificationService } from '../../../shared/services/notification.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-sprint-kanban',
  standalone: true,
  imports: [CommonModule, CdkDropList, CdkDrag, TicketCardComponent],
  templateUrl: './sprint-kanban.component.html',
  styles: ``
})
export class SprintKanbanComponent implements OnInit {
  @Input({ required: true }) sprintId!: number;

  aFaire = signal<SprintTicket[]>([]);
  enCours = signal<SprintTicket[]>([]);
  fait = signal<SprintTicket[]>([]);

  loading = signal(false);
  error = signal('');

  private notification = inject(NotificationService);

  constructor(private ticketService: TicketService) {}

  ngOnInit(): void {
    this.loadTickets();
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

