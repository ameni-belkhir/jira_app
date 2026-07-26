import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDropList, CdkDrag, CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import { TicketCardComponent, Ticket } from '../../projects/ticket-card/ticket-card.component';
import { BacklogSprint, BacklogTicket } from '../../../services/project.service';

@Component({
  selector: 'app-sprint-card',
  standalone: true,
  imports: [CommonModule, FormsModule, CdkDropList, CdkDrag, TicketCardComponent],
  templateUrl: './sprint-card.component.html',
  styles: ``
})
export class SprintCardComponent {
  @Input({ required: true }) sprint!: BacklogSprint;
  @Input() connectedDropLists: string[] = [];
  @Output() ticketDropped = new EventEmitter<{ ticketId: number; sprintId: number | null }>();
  @Output() goalUpdated = new EventEmitter<{ sprintId: number; goal: string }>();
  @Output() viewKanban = new EventEmitter<number>();

  isEditingGoal = false;
  editGoalValue = '';
  isCollapsed = signal(false);

  get completedTickets(): number {
    return this.sprint.tickets.filter(t => t.status?.toLowerCase() === 'done' || t.status?.toLowerCase() === 'completed').length;
  }

  get progressPercent(): number {
    if (this.sprint.tickets.length === 0) return 0;
    return Math.round((this.completedTickets / this.sprint.tickets.length) * 100);
  }

  get statusColor(): string {
    switch (this.sprint.status?.toLowerCase()) {
      case 'active': return 'bg-success-100 text-success-700 dark:bg-success-500/10 dark:text-success-400';
      case 'planning': return 'bg-blue-light-100 text-blue-light-700 dark:bg-blue-light-500/10 dark:text-blue-light-400';
      case 'completed': return 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400';
      case 'closed': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
  }

  toggleCollapse(event: MouseEvent): void {
    event.stopPropagation();
    this.isCollapsed.update(v => !v);
  }

  navigateToKanban(event: MouseEvent): void {
    event.stopPropagation();
    this.viewKanban.emit(this.sprint.id);
  }

  startEditGoal(): void {
    this.editGoalValue = this.sprint.goal || '';
    this.isEditingGoal = true;
  }

  saveGoal(): void {
    if (this.editGoalValue.trim() && this.editGoalValue.trim() !== this.sprint.goal) {
      this.goalUpdated.emit({ sprintId: this.sprint.id, goal: this.editGoalValue.trim() });
    }
    this.isEditingGoal = false;
  }

  cancelEditGoal(): void {
    this.isEditingGoal = false;
  }

  onDrop(event: CdkDragDrop<BacklogTicket[]>): void {
    if (event.previousContainer === event.container) return;

    const ticket = event.previousContainer.data[event.previousIndex];
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    this.ticketDropped.emit({ ticketId: ticket.id, sprintId: this.sprint.id });
  }

  trackByTicketId(index: number, ticket: BacklogTicket): number {
    return ticket.id;
  }

  mapToTicket(ticket: BacklogTicket): Ticket {
    return {
      id: ticket.id,
      title: ticket.title,
      priority: (ticket.priority as Ticket['priority']) || 'Medium',
      assignedUser: {
        name: ticket.assignedTo || 'Unassigned',
        avatar: ticket.assignedToAvatar || ''
      },
      dueDate: ticket.creationDate ? new Date(ticket.creationDate).toLocaleDateString() : '',
      labels: [],
      description: ticket.description || '',
      status: (ticket.status as Ticket['status']) || 'todo'
    };
  }
}

