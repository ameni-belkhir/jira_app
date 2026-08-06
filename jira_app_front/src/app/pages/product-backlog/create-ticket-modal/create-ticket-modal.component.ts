import { Component, Input, Output, EventEmitter, signal, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { CreateTicketRequest, ProjectService, ProjectMemberSummary } from '../../../services/project.service';
import { ProjectMembersService } from '../../../services/project-members.service';
import { UserRoleSelectorComponent, RoleSelectableUser } from '../../../shared/components/user-role-selector/user-role-selector.component';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-create-ticket-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, UserRoleSelectorComponent],
  templateUrl: './create-ticket-modal.component.html',
  styles: ``
})
export class CreateTicketModalComponent implements OnInit {
  @Input({ required: true }) projectId!: number;
  @Input({ required: true }) creatorId!: string;
  @Input() sprintId: number | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() create = new EventEmitter<CreateTicketRequest>();

  @ViewChild('ticketForm') ticketForm!: NgForm;

  isOpen = signal(false);
  title = '';
  description = '';
  priority = 'Medium';
  color = '#3b82f6';
  submitted = false;

  // Developer unique (assignee) — backend attend un seul AssigneeId
  projectMembers: ProjectMemberSummary[] = [];
  availableDevelopers: RoleSelectableUser[] = [];
  selectedAssigneeId: number | null = null;
  loadingMembers = signal(false);

  /** 5 preset colors for quick selection */
  readonly presetColors = [
    { value: '#3b82f6', label: 'Blue' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Amber' },
    { value: '#ef4444', label: 'Red' },
    { value: '#8b5cf6', label: 'Purple' }
  ];

  constructor(
    private projectService: ProjectService,
    private projectMembersService: ProjectMembersService
  ) {}

  ngOnInit(): void {}

  open(): void {
    this.resetForm();
    this.isOpen.set(true);
    this.submitted = false;
    this.loadProjectMembers();
  }

  closeModal(): void {
    this.isOpen.set(false);
    this.close.emit();
  }

  /** Charge les Developers du projet via l'endpoint dédié (rôle Developer uniquement). */
  private loadProjectMembers(): void {
    this.loadingMembers.set(true);
    this.projectMembersService.getAvailableDevelopers(this.projectId)
      .pipe(finalize(() => this.loadingMembers.set(false)))
      .subscribe({
        next: (developers) => {
          this.availableDevelopers = developers.slice();
        },
        error: () => {
          this.availableDevelopers = [];
        }
      });
  }

  onAssigneeSelectionChange(ids: number[]): void {
    this.selectedAssigneeId = ids.length > 0 ? ids[0] : null;
  }

  /** Map Angular priority ('Low'|'Medium'|'High'|'Critical') to backend FR enum */
  private mapPriorityToBackend(priority: string): string {
    const map: Record<string, string> = {
      'Low': 'BAS',
      'Medium': 'MOYENNE',
      'High': 'HAUTE',
      'Critical': 'CRITIQUE'
    };
    return map[priority] || 'MOYENNE';
  }

  onSubmit(): void {
    this.submitted = true;

    // Reject if Angular form is invalid
    if (this.ticketForm && this.ticketForm.invalid) return;

    // Trim and validate title
    const titre = this.title.trim();
    if (!titre) return;

    // Trim description; send null if empty (backend expects null, not '')
    const description = this.description.trim() || null;

    // Convert and validate projectId
    const projectId = Number(this.projectId);
    if (!projectId || projectId === 0) {
      console.error('Erreur: projectId invalide (0 ou null)');
      return;
    }

    // Convert creatorId (string from parent) → number
    const creatorId = Number(this.creatorId);
    if (!creatorId || creatorId === 0) {
      console.error('Erreur: creatorId invalide (0 ou null)');
      return;
    }

    // Map Angular priority string → backend French enum value
    const priority = this.mapPriorityToBackend(this.priority);

// Build clean payload without syntax errors or duplicate declarations
    const payload: CreateTicketRequest = {
      titre,
      description,
      priority,
      projectId,
      creatorId,
      sprintId: this.sprintId,
      color: this.color,
      assigneeId: this.selectedAssigneeId
    };

    console.log('✅ Payload Ticket envoyé au backend :', JSON.stringify(payload, null, 2));

    this.create.emit(payload);
    this.isOpen.set(false);
    this.resetForm();
  }

  private resetForm(): void {
    this.title = '';
    this.description = '';
    this.priority = 'Medium';
    this.color = '#3b82f6';
    this.submitted = false;
    this.selectedAssigneeId = null;
    this.ticketForm?.resetForm();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }
}

