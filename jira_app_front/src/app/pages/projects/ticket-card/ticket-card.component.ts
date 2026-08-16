import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeImagePipe } from '../../../shared/pipe/safe-image.pipe';

export interface Ticket {
  id: number;
  title: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  assignedUser: { name: string; avatar: string };
  dueDate: string;
  labels: string[];
  description: string;
  status: 'todo' | 'in-progress' | 'testing' | 'done';
  color?: string;
  subTickets?: Ticket[];
  isExpanded?: boolean;
}

@Component({
  selector: 'app-ticket-card',
  standalone: true,
  imports: [CommonModule, SafeImagePipe],
  templateUrl: './ticket-card.component.html',
  styles: ``
})
export class TicketCardComponent {
  @Input({ required: true })
  set ticket(value: Ticket) {
    this._ticket = value;
    if (this.expandedForTicketId !== value.id) {
      this.expandedForTicketId = value.id;
      this.isSubticketsExpanded = value.isExpanded ?? false;
    }
  }
  get ticket(): Ticket {
    return this._ticket;
  }
  private _ticket!: Ticket;

  @Input() showSubticketButton: boolean = false;
  @Input() showDeleteButton: boolean = false;
  @Input() depth: number = 0;
  @Input() canAssignTicket: boolean = false;
  @Output() viewSubtickets = new EventEmitter<number>();
  @Output() createSubticketRequested = new EventEmitter<number>();
  @Output() deleteRequested = new EventEmitter<number>();
  @Output() viewDetails = new EventEmitter<number>();
  @Output() assignRequested = new EventEmitter<Ticket>();

  // Propriété pour gérer l'affichage des sous-tickets
  isSubticketsExpanded: boolean = false;
  private expandedForTicketId: number | null = null;

  // Modal de confirmation de suppression (visible uniquement pour l'Admin)
  confirmingDelete: boolean = false;

  get hasSubtickets(): boolean {
    return !!this.ticket.subTickets && this.ticket.subTickets.length > 0;
  }

  toggleSubtickets(event?: Event): void {
    if (event) {
      event.stopPropagation(); // Évite les conflits de clics
    }
    if (!this.hasSubtickets) return;
    this.isSubticketsExpanded = !this.isSubticketsExpanded;
  }

  openCreateSubticketModal(event?: Event): void {
    if (event) {
      event.stopPropagation(); // Évite la propagation de clic
    }
    this.createSubticketRequested.emit(this.ticket.id);
  }

  openDeleteConfirm(event?: Event): void {
    if (event) {
      event.stopPropagation(); // Ne déclenche pas l'ouverture des sous-tickets
    }
    this.confirmingDelete = true;
  }

  openDetails(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.viewDetails.emit(this.ticket.id);
  }

  openAssignModal(event?: Event): void {
    // Zone non cliquable sans droit : le clic suit son cours (toggleSubtickets), comportement inchangé.
    if (!this.canAssignTicket) return;
    if (event) {
      event.stopPropagation();
    }
    this.assignRequested.emit(this.ticket);
  }

  closeDeleteConfirm(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.confirmingDelete = false;
  }

  confirmDelete(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.confirmingDelete = false;
    this.deleteRequested.emit(this.ticket.id);
  }

  get priorityColor(): string {
    switch (this.ticket.priority) {
      case 'Low': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
      case 'Medium': return 'bg-blue-light-100 text-blue-light-700 dark:bg-blue-light-900/30 dark:text-blue-light-400';
      case 'High': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'Critical': return 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400';
      default: return 'bg-gray-100 text-gray-600';
    }
  }
}