import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Conversation } from '../../../services/chat.service';

@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-sidebar.component.html',
  styles: ``,
})
export class ChatSidebarComponent {
  @Input() conversations: Conversation[] = [];
  @Input() activeConversationId: string | number | null = null;
  @Input() onlineUsers: Record<string, boolean> = {};

  @Output() selectConversation = new EventEmitter<Conversation>();

  searchTerm = '';

  get filteredConversations(): Conversation[] {
    if (!this.searchTerm.trim()) return this.conversations;
    const term = this.searchTerm.toLowerCase();
    return this.conversations.filter((c) => c.name.toLowerCase().includes(term));
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
}
