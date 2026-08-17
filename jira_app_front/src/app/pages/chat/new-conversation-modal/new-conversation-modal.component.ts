import { Component, Output, EventEmitter, signal, inject, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth.service';
import { SafeImagePipe } from '../../../shared/pipe/safe-image.pipe';

/** Utilisateur affiché dans le sélecteur de membres. */
export interface ChatContact {
  id: number;
  name: string;
  email: string;
  avatar?: string;
}

export interface NewConversationData {
  name: string;
  isGroup: boolean;
  projectId: number | null;
  memberUserIds: number[];
}

@Component({
  selector: 'app-new-conversation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeImagePipe],
  templateUrl: './new-conversation-modal.component.html',
  styles: ``,
})
export class NewConversationModalComponent implements OnChanges {
  @Input() open = false;
  @Output() close = new EventEmitter<void>();
  @Output() create = new EventEmitter<NewConversationData>();

  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.baseUrl.replace(/\/$/, '')}/api`;

  isGroup = true;
  name = '';
  projectId: number | null = null;
  searchTerm = '';
  contacts: ChatContact[] = [];
  selectedIds = new Set<number>();
  loading = signal(false);
  submitting = signal(false);
  error = '';

  get filteredContacts(): ChatContact[] {
    const term = this.searchTerm.trim().toLowerCase();
    const currentUserId = Number(this.authService.getUserId());
    return this.contacts.filter((c) => {
      if (c.id === currentUserId) return false;
      if (!term) return true;
      const hay = `${c.name} ${c.email}`.toLowerCase();
      return hay.includes(term);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.reset();
      this.loadContacts();
    }
  }

  async loadContacts(): Promise<void> {
    this.loading.set(true);
    try {
      const users: any[] = await firstValueFrom(
        this.http.get<any[]>(`${this.apiUrl}/Users`)
      );
      this.contacts = (users ?? []).map((u: any) => ({
        id: u.id,
        name: `${u.prenom ?? ''} ${u.nom ?? ''}`.trim() || u.email,
        email: u.email,
        avatar: u.profileImageUrl,
      }));
    } catch {
      this.contacts = [];
    } finally {
      this.loading.set(false);
    }
  }

  closeModal(): void {
    this.close.emit();
  }

  toggleContact(id: number): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  async submit(): Promise<void> {
    this.error = '';
    if (this.selectedIds.size === 0) {
      this.error = 'Sélectionnez au moins un participant.';
      return;
    }
    if (this.isGroup && !this.name.trim()) {
      this.error = 'Donnez un nom au groupe.';
      return;
    }

    const firstId = this.selectedIds.values().next().value;
    const firstContact = this.contacts.find((c) => c.id === firstId);

    this.submitting.set(true);
    try {
      this.create.emit({
        name: this.isGroup ? this.name.trim() : (firstContact?.name ?? 'Conversation'),
        isGroup: this.isGroup,
        projectId: this.projectId,
        memberUserIds: Array.from(this.selectedIds),
      });
      this.reset();
    } finally {
      this.submitting.set(false);
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }

  private reset(): void {
    this.isGroup = true;
    this.name = '';
    this.projectId = null;
    this.searchTerm = '';
    this.selectedIds.clear();
    this.error = '';
  }
}

