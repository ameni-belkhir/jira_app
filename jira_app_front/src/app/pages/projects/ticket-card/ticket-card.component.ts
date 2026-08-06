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
}

@Component({
  selector: 'app-ticket-card',
  standalone: true,
  imports: [CommonModule, SafeImagePipe],
  templateUrl: './ticket-card.component.html',
  styles: ``
})
export class TicketCardComponent {
  @Input({ required: true }) ticket!: Ticket;
  @Input() showSubticketButton: boolean = false;
  @Output() viewSubtickets = new EventEmitter<number>();

  get priorityColor(): string {
    switch (this.ticket.priority) {
      case 'Low': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
      case 'Medium': return 'bg-blue-light-100 text-blue-light-700 dark:bg-blue-light-900/30 dark:text-blue-light-400';
      case 'High': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'Critical': return 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  onViewSubtickets(event: MouseEvent): void {
    event.stopPropagation();
    this.viewSubtickets.emit(this.ticket.id);
  }
}
