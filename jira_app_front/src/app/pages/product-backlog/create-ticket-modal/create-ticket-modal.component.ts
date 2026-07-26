import { Component, Input, Output, EventEmitter, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { CreateTicketRequest } from '../../../services/project.service';

@Component({
  selector: 'app-create-ticket-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-ticket-modal.component.html',
  styles: ``
})
export class CreateTicketModalComponent {
  @Input({ required: true }) projectId!: number;
  @Input({ required: true }) creatorId!: string;
  @Output() close = new EventEmitter<void>();
  @Output() create = new EventEmitter<CreateTicketRequest>();

  @ViewChild('ticketForm') ticketForm!: NgForm;

  isOpen = signal(false);
  title = '';
  description = '';
  priority = 'Medium';
  color = '#3b82f6';
  submitted = false;

  /** 5 preset colors for quick selection */
  readonly presetColors = [
    { value: '#3b82f6', label: 'Blue' },
    { value: '#10b981', label: 'Green' },
    { value: '#f59e0b', label: 'Amber' },
    { value: '#ef4444', label: 'Red' },
    { value: '#8b5cf6', label: 'Purple' }
  ];

  open(): void {
    this.resetForm();
    this.isOpen.set(true);
    this.submitted = false;
  }

  closeModal(): void {
    this.isOpen.set(false);
    this.close.emit();
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
      sprintId: null,
      color: this.color
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
    this.ticketForm?.resetForm();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }
}

