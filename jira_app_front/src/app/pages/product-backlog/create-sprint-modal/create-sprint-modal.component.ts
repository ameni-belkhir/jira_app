import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SprintRequest } from '../../../services/project.service';

@Component({
  selector: 'app-create-sprint-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  open(): void {
    this.resetForm();
    this.isOpen.set(true);
    this.submitted = false;
  }

  closeModal(): void {
    this.isOpen.set(false);
    this.close.emit();
  }

  onSubmit(): void {
    this.submitted = true;
    if (!this.name.trim()) return;

    this.create.emit({
      projectId: this.projectId,
      name: this.name.trim(),
      goal: this.goal.trim(),
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined
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
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }
}

