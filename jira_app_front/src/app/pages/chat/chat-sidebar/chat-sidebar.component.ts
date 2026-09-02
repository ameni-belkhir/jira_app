import { Component, Input, Output, EventEmitter, inject, OnInit, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Conversation } from '../../../services/chat.service';
import { ChatContact } from '../new-conversation-modal/new-conversation-modal.component';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';
import { SafeImagePipe } from '../../../shared/pipe/safe-image.pipe';

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeImagePipe],
  templateUrl: './chat-sidebar.component.html',
  styles: ``,
})
export class ChatSidebarComponent implements OnInit {
  @Input() conversations: Conversation[] = [];
  @Input() activeConversationId: string | number | null = null;
  @Input() onlineUsers: Record<string, boolean> = {};

  @Output() selectConversation = new EventEmitter<Conversation>();
  @Output() newConversation = new EventEmitter<void>();
  @Output() startDirectConversation = new EventEmitter<{ userId: number; name: string }>();

  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private elementRef = inject(ElementRef);
  private readonly apiUrl = `${environment.baseUrl.replace(/\/$/, '')}/api`;

  searchTerm = '';
  contacts: ChatContact[] = [];
  contactsLoading = false;
  contactCreating: number | null = null;
  showContactMenu = false;

  ngOnInit(): void {
    this.loadContacts();
  }

  get filteredConversations(): Conversation[] {
    const currentUserId = Number(this.authService.getUserId());
    const visible = this.conversations
      .filter((c) => !(c.otherUserId != null && Number(c.otherUserId) === currentUserId));
    if (!this.searchTerm.trim()) return visible;
    const term = this.searchTerm.toLowerCase();
    return visible.filter((c) => c.name.toLowerCase().includes(term));
  }

  get filteredContacts(): ChatContact[] {
    const term = this.searchTerm.trim().toLowerCase();
    const currentUserId = Number(this.authService.getUserId());
    const directIds = new Set(
      this.conversations
        .filter((c) => !c.isGroup && c.otherUserId != null)
        .map((c) => Number(c.otherUserId))
    );
    return this.contacts.filter((c) => {
      if (c.id === currentUserId) return false;
      if (directIds.has(c.id)) return false;
      if (!term) return true;
      const hay = `${c.name} ${c.email}`.toLowerCase();
      return hay.includes(term);
    });
  }

  isOnline(conv: Conversation): boolean {
    if (conv.isOnline !== undefined) return conv.isOnline;
    if (conv.otherUserId != null) {
      return !!this.onlineUsers[String(conv.otherUserId)];
    }
    return false;
  }

  formatTime(value?: Date | string): string {
    if (!value) return '';
    const d = new Date(value);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  select(conv: Conversation): void {
    this.selectConversation.emit(conv);
  }

  async startDirect(userId: number): Promise<void> {
    if (this.contactCreating !== null) return;
    this.contactCreating = userId;
    try {
      const contact = this.contacts.find((c) => c.id === userId);
      this.startDirectConversation.emit({ userId, name: contact?.name ?? 'Conversation' });
      this.showContactMenu = false;
    } finally {
      this.contactCreating = null;
    }
  }

  toggleContactMenu(): void {
    this.showContactMenu = !this.showContactMenu;
  }

  closeContactMenu(): void {
    this.showContactMenu = false;
  }

  /** Ferme le dropdown au clic en dehors de la sidebar. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.showContactMenu && !this.elementRef.nativeElement.contains(event.target)) {
      this.showContactMenu = false;
    }
  }

  isCreatingContact(userId: number): boolean {
    return this.contactCreating === userId;
  }

  private async loadContacts(): Promise<void> {
    this.contactsLoading = true;
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
      this.contactsLoading = false;
    }
  }
}
