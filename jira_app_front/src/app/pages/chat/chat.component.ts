import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ChatService, Conversation, ChatMessage } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { ChatSidebarComponent } from './chat-sidebar/chat-sidebar.component';
import { ChatWindowComponent } from './chat-window/chat-window.component';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, ChatSidebarComponent, ChatWindowComponent],
  templateUrl: './chat.component.html',
  styles: ``,
})
export class ChatComponent implements OnInit, OnDestroy {
  private chatService = inject(ChatService);
  private authService = inject(AuthService);

  conversations = signal<Conversation[]>([]);
  activeConversation = signal<Conversation | null>(null);
  messages = signal<ChatMessage[]>([]);
  typingUsers = signal<Record<string, string>>({});
  onlineUsers = signal<Record<string, boolean>>({});
  currentUserId: string | number | null = null;

  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.currentUserId = this.authService.getUserId();

    // Wire up the SignalR-driven observables.
    this.subs.push(
      this.chatService.activeConversations$.subscribe((convs) => {
        this.conversations.set(convs);
        // Keep active conversation reference in sync.
        const active = this.activeConversation();
        if (active) {
          const updated = convs.find((c) => c.id === active.id);
          if (updated) this.activeConversation.set(updated);
        }
      }),
      this.chatService.messages$.subscribe((msgs) => this.messages.set(msgs)),
      this.chatService.typingUsers$.subscribe((t) => this.typingUsers.set(t)),
      this.chatService.onlineUsers$.subscribe((o) => this.onlineUsers.set(o)),
    );

    // Seed with demo conversations so the UI is populated while the
    // SignalR / REST backend delivers real data.
    this.seedConversations();

    // Start the real-time connection (JWT authenticated).
    this.chatService.startConnection();
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    // Keep the connection alive across navigation; only stop on logout.
    // If you want it bound to the page lifecycle, uncomment the next line:
    // this.chatService.stopConnection();
  }

  selectConversation(conv: Conversation): void {
    this.activeConversation.set(conv);
    this.chatService.setActiveConversation(conv.id);
    this.chatService.markAsRead(conv.id);
  }

  onSend(payload: { text: string; type: 'text' | 'file' | 'image'; fileName?: string; fileSize?: number }): void {
    const conv = this.activeConversation();
    if (!conv) return;
    this.chatService.sendMessage(conv.id, payload.text, payload.type, payload.fileName, payload.fileSize);
  }

  onTyping(typing: boolean): void {
    const conv = this.activeConversation();
    if (!conv) return;
    this.chatService.sendTyping(conv.id, typing);
  }

onMarkAsRead(): void {
    const conv = this.activeConversation();
    if (!conv) return;
    this.chatService.markAsRead(conv.id);
  }

  isConversationOnline(): boolean {
    const conv = this.activeConversation();
    if (!conv) return false;
    if (conv.isOnline !== undefined) return conv.isOnline;
    if (conv.otherUserId != null) {
      return !!this.onlineUsers()[String(conv.otherUserId)];
    }
    return false;
  }

  private seedConversations(): void {
    const now = new Date();
    const demo: Conversation[] = [
      {
        id: 1,
        name: 'Emily Chen',
        otherUserId: 101,
        avatar: '/images/user/user-01.jpg',
        lastMessage: 'J\u2019ai bien reçu ton message.',
        lastMessageAt: new Date(now.getTime() - 2 * 60000),
        unreadCount: 2,
        isOnline: true,
        messages: [
          { id: 1, conversationId: 1, senderId: 101, senderName: 'Emily Chen', text: 'Salut ! Tu as vu les maquettes ?', timestamp: new Date(now.getTime() - 10 * 60000), isRead: true },
          { id: 2, conversationId: 1, senderId: 0, text: 'Pas encore, tu peux m\u2019envoyer le lien ?', timestamp: new Date(now.getTime() - 8 * 60000), isRead: true },
          { id: 3, conversationId: 1, senderId: 101, senderName: 'Emily Chen', text: 'J\u2019ai bien reçu ton message.', timestamp: new Date(now.getTime() - 2 * 60000), isRead: false },
        ],
      },
      {
        id: 2,
        name: 'Alex Rivera',
        otherUserId: 102,
        avatar: '/images/user/user-02.jpg',
        lastMessage: 'Le déploiement est prévu demain.',
        lastMessageAt: new Date(now.getTime() - 15 * 60000),
        isOnline: true,
        messages: [
          { id: 1, conversationId: 2, senderId: 102, senderName: 'Alex Rivera', text: 'Le pipeline CI est prêt.', timestamp: new Date(now.getTime() - 30 * 60000), isRead: true },
          { id: 2, conversationId: 2, senderId: 0, text: 'Super, des soucis ?', timestamp: new Date(now.getTime() - 20 * 60000), isRead: true },
          { id: 3, conversationId: 2, senderId: 102, senderName: 'Alex Rivera', text: 'Le déploiement est prévu demain.', timestamp: new Date(now.getTime() - 15 * 60000), isRead: false },
        ],
      },
      {
        id: 3,
        name: 'Sarah Kim',
        otherUserId: 103,
        avatar: '/images/user/user-03.jpg',
        lastMessage: 'La doc API est prête.',
        lastMessageAt: new Date(now.getTime() - 60 * 60000),
        isOnline: false,
        messages: [
          { id: 1, conversationId: 3, senderId: 103, senderName: 'Sarah Kim', text: 'J\u2019ai terminé la documentation.', timestamp: new Date(now.getTime() - 120 * 60000), isRead: true },
          { id: 2, conversationId: 3, senderId: 0, text: 'Génial, je vais vérifier.', timestamp: new Date(now.getTime() - 90 * 60000), isRead: true },
          { id: 3, conversationId: 3, senderId: 103, senderName: 'Sarah Kim', text: 'La doc API est prête.', timestamp: new Date(now.getTime() - 60 * 60000), isRead: true },
        ],
      },
    ];
    this.chatService.setConversations(demo);
  }
}
