import { Component, Input, signal } from '@angular/core';
import { CdkDragDrop, CdkDropList, CdkDrag, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { TicketCardComponent, Ticket } from '../ticket-card/ticket-card.component';

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [CommonModule, CdkDropList, CdkDrag, TicketCardComponent],
  templateUrl: './kanban-board.component.html',
  styles: ``
})
export class KanbanBoardComponent {
  @Input() projectName: string = 'Project';

  todo = signal<Ticket[]>([
    { id: 1, title: 'Design login page UI', priority: 'Medium', assignedUser: { name: 'Emily Chen', avatar: '/images/user/user-01.jpg' }, dueDate: 'Dec 10', labels: ['UI', 'Frontend'], description: 'Create wireframes and mockups for login flow.', status: 'todo', color: '#3b82f6' },
    { id: 2, title: 'Set up CI/CD pipeline', priority: 'High', assignedUser: { name: 'Alex Rivera', avatar: '/images/user/user-02.jpg' }, dueDate: 'Dec 12', labels: ['DevOps'], description: 'Configure GitHub Actions for automated deployment.', status: 'todo', color: '#f59e0b' },
    { id: 3, title: 'Write API documentation', priority: 'Low', assignedUser: { name: 'Sarah Kim', avatar: '/images/user/user-03.jpg' }, dueDate: 'Dec 15', labels: ['Docs'], description: 'Document all REST API endpoints with examples.', status: 'todo', color: '#10b981' },
  ]);

  inProgress = signal<Ticket[]>([
    { id: 4, title: 'Implement user authentication', priority: 'Critical', assignedUser: { name: 'James Wilson', avatar: '/images/user/user-04.jpg' }, dueDate: 'Dec 8', labels: ['Backend', 'Security'], description: 'Add JWT-based authentication with refresh tokens.', status: 'in-progress', color: '#ef4444' },
    { id: 5, title: 'Build dashboard widgets', priority: 'Medium', assignedUser: { name: 'Emily Chen', avatar: '/images/user/user-01.jpg' }, dueDate: 'Dec 14', labels: ['Frontend'], description: 'Create reusable chart and metric components.', status: 'in-progress', color: '#3b82f6' },
  ]);

  testing = signal<Ticket[]>([
    { id: 6, title: 'Test payment integration', priority: 'High', assignedUser: { name: 'Mia Johnson', avatar: '/images/user/user-05.jpg' }, dueDate: 'Dec 9', labels: ['QA', 'Payments'], description: 'Verify Stripe integration works end-to-end.', status: 'testing', color: '#8b5cf6' },
  ]);

  done = signal<Ticket[]>([
    { id: 7, title: 'Setup database schema', priority: 'High', assignedUser: { name: 'Alex Rivera', avatar: '/images/user/user-02.jpg' }, dueDate: 'Dec 1', labels: ['Backend'], description: 'Design and implement initial PostgreSQL schema.', status: 'done', color: '#10b981' },
    { id: 8, title: 'User profile page', priority: 'Medium', assignedUser: { name: 'Sarah Kim', avatar: '/images/user/user-03.jpg' }, dueDate: 'Dec 5', labels: ['Frontend'], description: 'Create profile edit and view pages.', status: 'done', color: '#3b82f6' },
  ]);

  columns: { id: string; title: string; data: ReturnType<typeof signal<Ticket[]>> }[] = [];

  ngOnInit() {
    this.columns = [
      { id: 'todo', title: 'To Do', data: this.todo },
      { id: 'inProgress', title: 'In Progress', data: this.inProgress },
      { id: 'testing', title: 'Testing', data: this.testing },
      { id: 'done', title: 'Done', data: this.done },
    ];
  }

  drop(event: CdkDragDrop<Ticket[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
    // Update signals to trigger re-render
    this.todo.set([...this.todo()]);
    this.inProgress.set([...this.inProgress()]);
    this.testing.set([...this.testing()]);
    this.done.set([...this.done()]);
  }
}
