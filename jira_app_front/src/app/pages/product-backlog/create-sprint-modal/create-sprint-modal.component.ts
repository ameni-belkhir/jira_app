import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SprintRequest, ProjectService, ProjectMemberSummary } from '../../../services/project.service';
import { ProjectMembersService } from '../../../services/project-members.service';
import { UserRoleSelectorComponent, RoleSelectableUser } from '../../../shared/components/user-role-selector/user-role-selector.component';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-create-sprint-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, UserRoleSelectorComponent],
  templateUrl: './create-sprint-modal.component.html',
  styles: ``
})
export class CreateSprintModalComponent {
  @Input({ required: true }) projectId!: number;
  @Output() close = new EventEmitter<void>();
  @Output() create = new EventEmitter<SprintRequest>();

  isOpen = signal(false);
  name = '';
  goal = '';
  startDate = '';
  endDate = '';
  submitted = false;

  // Seniors disponibles (rôle Senior) à affecter au projet
  availableSeniors: RoleSelectableUser[] = [];
  selectedSeniorIds: number[] = [];
  loadingMembers = signal(false);

  constructor(
    private projectService: ProjectService,
    private projectMembersService: ProjectMembersService
  ) {}

  open(): void {
    this.resetForm();
    this.isOpen.set(true);
    this.submitted = false;
    this.loadSeniors();
  }

  closeModal(): void {
    this.isOpen.set(false);
    this.close.emit();
  }

  /** Charge les Seniors disponibles pour ce projet via l'endpoint dédié. */
  private loadSeniors(): void {
    this.loadingMembers.set(true);
    this.projectMembersService.getAvailableSeniors(this.projectId)
      .pipe(finalize(() => this.loadingMembers.set(false)))
      .subscribe({
        next: (seniors) => {
          this.availableSeniors = seniors.slice();
        },
        error: () => {
          this.availableSeniors = [];
        }
      });
  }

  onSeniorSelectionChange(ids: number[]): void {
    this.selectedSeniorIds = ids;
  }

  onSubmit(): void {
    this.submitted = true;
    if (!this.name.trim()) return;

    this.create.emit({
      projectId: this.projectId,
      name: this.name.trim(),
      goal: this.goal.trim(),
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined,
      assignedUserIds: this.selectedSeniorIds.length > 0 ? this.selectedSeniorIds : undefined
    });

    this.isOpen.set(false);
    this.resetForm();
  }

  private resetForm(): void {
    this.name = '';
    this.goal = '';
    this.startDate = '';
    this.endDate = '';
    this.submitted = false;
    this.selectedSeniorIds = [];
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }
}

