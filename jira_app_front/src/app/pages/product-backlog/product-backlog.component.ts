import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { CdkDropList, CdkDrag, CdkDragDrop, transferArrayItem } from '@angular/cdk/drag-drop';
import { finalize, debounceTime, Subject, tap, switchMap } from 'rxjs';
import { ProjectService, BacklogResponse, BacklogTicket, SprintRequest } from '../../services/project.service';
import { TicketCardComponent, Ticket } from '../projects/ticket-card/ticket-card.component';
import { SprintCardComponent } from './sprint-card/sprint-card.component';
import { CreateSprintModalComponent } from './create-sprint-modal/create-sprint-modal.component';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-product-backlog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CdkDropList,
    CdkDrag,
    TicketCardComponent,
    SprintCardComponent,
    CreateSprintModalComponent
  ],
  templateUrl: './product-backlog.component.html',
  styles: ``
})
export class ProductBacklogComponent implements OnInit {
  @ViewChild(CreateSprintModalComponent) createSprintModal!: CreateSprintModalComponent;

  projectId: number = 0;
  projectName: string = '';

  // Data
  backlogData = signal<BacklogResponse | null>(null);
  loading = signal(false);
  error = signal('');

  // Search
  searchQuery = '';
  filteredUnassignedTickets = signal<BacklogTicket[]>([]);

  // Refresh
  refreshing = signal(false);
  private refreshSubject = new Subject<void>();

  // Project name mapping (fallback)
  private projectNames: Record<number, string> = {
    1: 'CRM System',
    2: 'E-Commerce Website',
    3: 'Mobile Application',
    4: 'Internal HR',
    5: 'Inventory System'
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService
  ) {
    this.refreshSubject.pipe(
      debounceTime(300)
    ).subscribe(() => this.loadBacklog());
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.projectId = parseInt(idParam, 10);
      this.projectName = this.projectNames[this.projectId] || `Project #${this.projectId}`;
      this.loadBacklog();
    }
  }

  loadBacklog(): void {
    if (this.loading()) return;

    this.loading.set(true);
    this.error.set('');

    this.projectService.getBacklog(this.projectId)
      .pipe(finalize(() => {
        this.loading.set(false);
        this.refreshing.set(false);
      }))
      .subscribe({
        next: (data) => {
          this.backlogData.set(data);
          this.applySearch();
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 0) {
            this.error.set('Cannot connect to server. Please check your connection.');
          } else if (err.status === 404) {
            this.error.set('Project not found.');
          } else {
            this.error.set('Failed to load backlog. Please try again.');
          }
        }
      });
  }

  refresh(): void {
    this.refreshing.set(true);
    this.loadBacklog();
  }

  // Search
  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.applySearch();
  }

  private applySearch(): void {
    const q = this.searchQuery.toLowerCase().trim();
    const unassigned = this.backlogData()?.unassignedTickets || [];

    if (!q) {
      this.filteredUnassignedTickets.set(unassigned);
      return;
    }

    this.filteredUnassignedTickets.set(
      unassigned.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.priority?.toLowerCase().includes(q) ||
        t.status?.toLowerCase().includes(q) ||
        t.assignedTo?.toLowerCase().includes(q)
      )
    );
  }

  // Get drop list IDs for all sprint containers
  getConnectedDropListIds(): string[] {
    const ids: string[] = ['backlog-drop-list'];
    if (this.backlogData()?.sprints) {
      for (const sprint of this.backlogData()!.sprints) {
        ids.push(`sprint-${sprint.id}`);
      }
    }
    return ids;
  }

  // Handle drop on backlog (unassigned) zone
  onBacklogDrop(event: CdkDragDrop<BacklogTicket[]>): void {
    if (event.previousContainer === event.container) return;

    const ticket = event.previousContainer.data[event.previousIndex];
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    this.callMoveTicket(ticket.id, null);
  }

  // Handle ticket dropped in a sprint (emitted from sprint-card)
  onTicketDroppedInSprint(data: { ticketId: number; sprintId: number | null }): void {
    this.callMoveTicket(data.ticketId, data.sprintId);
  }

  // Handle goal update (emitted from sprint-card)
  onGoalUpdated(data: { sprintId: number; goal: string }): void {
    this.projectService.updateSprint(data.sprintId, { goal: data.goal })
      .subscribe({
        error: () => {
          this.error.set('Failed to update sprint goal. Please try again.');
        }
      });
  }

  private callMoveTicket(ticketId: number, sprintId: number | null): void {
    this.projectService.moveTicketToSprint(ticketId, { ticketId, sprintId })
      .subscribe({
        error: () => {
          this.error.set('Failed to move ticket. Please try again.');
          this.loadBacklog(); // Reload to restore state on error
        }
      });
  }

  // Open create sprint modal
  openCreateSprintModal(): void {
    this.createSprintModal.open();
  }

  // Handle sprint creation
  onCreateSprint(data: SprintRequest): void {
    this.projectService.createSprint(data)
      .subscribe({
        next: () => {
          this.loadBacklog();
        },
        error: () => {
          this.error.set('Failed to create sprint. Please try again.');
        }
      });
  }

  // Map BacklogTicket to Ticket for the reusable TicketCardComponent
  mapToTicket(ticket: BacklogTicket): Ticket {
    return {
      id: ticket.id,
      title: ticket.title,
      priority: (ticket.priority as Ticket['priority']) || 'Medium',
      assignedUser: {
        name: ticket.assignedTo || 'Unassigned',
        avatar: ticket.assignedToAvatar || '/images/user/user-01.jpg'
      },
      dueDate: ticket.creationDate ? new Date(ticket.creationDate).toLocaleDateString() : '',
      labels: [],
      description: ticket.description || '',
      status: (ticket.status as Ticket['status']) || 'todo'
    };
  }

  trackByTicketId(index: number, ticket: BacklogTicket): number {
    return ticket.id;
  }
}

