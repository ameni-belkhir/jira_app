import { Component, Input, Output, EventEmitter, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

export interface InviteMemberData {
  email: string;
  role: string;
  projectId: number;
}

@Component({
  selector: 'app-invite-member-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './invite-member-modal.component.html',
  styles: ``
})
export class InviteMemberModalComponent {
  @Input({ required: true }) projectId!: number;
  @Output() close = new EventEmitter<void>();
  @Output() invite = new EventEmitter<InviteMemberData>();

  @ViewChild('inviteForm') inviteForm!: NgForm;

  isOpen = signal(false);
  email = '';
  role = 'Developer';
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

    if (this.inviteForm && this.inviteForm.invalid) return;

    const email = this.email.trim();
    if (!email) return;

    this.invite.emit({
      email,
      role: this.role,
      projectId: this.projectId
    });

    this.isOpen.set(false);
    this.resetForm();
  }

  private resetForm(): void {
    this.email = '';
    this.role = 'Developer';
    this.submitted = false;
    this.inviteForm?.resetForm();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }
}

