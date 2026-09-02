import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ChatService, Conversation, ChatMessage } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { ChatSidebarComponent } from './chat-sidebar/chat-sidebar.component';
import { ChatWindowComponent } from './chat-window/chat-window.component';
import {
  NewConversationModalComponent,
  NewConversationData,
} from './new-conversation-modal/new-conversation-modal.component';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, ChatSidebarComponent, ChatWindowComponent, NewConversationModalComponent],
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
  /** L'Admin global peut modifier/supprimer n'importe quel message. */
  isAdmin = false;
  showNewConversation = signal(false);
  loadError = signal(false);
  /** Verrou anti-envoi multiple (désactive le bouton pendant l'envoi). */
  isSending = signal(false);
  /** Canal prêt uniquement après confirmation du JoinConversation SignalR (évite la course au 1er message). */
  channelReady = signal(false);

  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.currentUserId = this.authService.getUserId();
    this.isAdmin = this.authService.isAdmin();

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

    // Start the real-time connection (JWT authenticated).
    this.chatService.startConnection();

    // Charge les vraies conversations depuis le backend REST.
    this.loadRealConversations();
  }

  private async loadRealConversations(): Promise<void> {
    try {
      const convs = await this.chatService.loadConversations();
      this.loadError.set(false);
      this.conversations.set(convs);
    } catch {
      // Backend injoignable : état vide explicite, aucune donnée simulée.
      this.loadError.set(true);
      this.conversations.set([]);
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    // DÉCISION : NE PAS stopper la connexion ici. La fermeture au ngOnDestroy
    // casserait la réception des messages/typing en arrière-plan quand on
    // navigue vers une autre page, et forcerait un reconnect+join à chaque
    // retour sur le chat. La vraie fix du bug de sécurité cross-utilisateur
    // est au niveau du LOGOUT : AuthService.logout() appelle désormais
    // ChatService.stopConnection() (voir services/auth.service.ts:stopChatSignalR),
    // et ChatService.startConnection() recrée la connexion si l'utilisateur
    // a changé (voir services/chat.service.ts:startConnection).
    // this.chatService.stopConnection();
  }

  async selectConversation(conv: Conversation): Promise<void> {
    // Laisser la conversation précédente : quitter son groupe SignalR.
    const previous = this.activeConversation();
    if (previous && previous.id !== conv.id) {
      this.chatService.leaveConversation(previous.id);
    }

    // Bloque l'envoi tant que le join SignalR n'est pas confirmé (course au premier message).
    this.channelReady.set(false);

    this.activeConversation.set(conv);
    this.chatService.setActiveConversation(conv.id);
    this.chatService.markAsRead(conv.id);

    // Attend la confirmation de l'inscription au groupe avant d'autoriser l'envoi.
    await this.chatService.joinConversation(conv.id);
    this.channelReady.set(true);

    // Charge l'historique réel des messages via l'API REST.
    this.chatService.loadMessages(conv.id).then((msgs) => this.messages.set(msgs));
  }

async onSend(payload: { text: string; type: 'text' | 'file' | 'image'; fileName?: string; fileSize?: number; file?: File }): Promise<void> {
    const conv = this.activeConversation();
    if (!conv) return;

    // Anti double-envoi : ignore toute émission tant que l'envoi précédent n'est pas terminé.
    if (this.isSending()) return;
    // Anti course : le canal n'est pas encore inscrit au groupe SignalR.
    if (!this.channelReady()) return;
    this.isSending.set(true);

    try {
      if (payload.type === 'file' || payload.type === 'image') {
        // Pour une pièce jointe, on monte d'abord le fichier réel via
        // `uploadAttachment`, puis on envoie le message avec l'URL obtenue.
        if (!payload.file) return;
        const url = await this.chatService.uploadAttachment(payload.file);
        await this.chatService.sendMessage(conv.id, payload.text, payload.type, url ?? undefined, payload.fileName, payload.fileSize);
        return;
      }

      await this.chatService.sendMessage(conv.id, payload.text, payload.type);
    } finally {
      this.isSending.set(false);
    }
  }

onTyping(typing: boolean): void {
    const conv = this.activeConversation();
    if (!conv) return;
    this.chatService.sendTyping(conv.id, typing);
  }

  openNewConversation(): void {
    this.showNewConversation.set(true);
  }

  closeNewConversation(): void {
    this.showNewConversation.set(false);
  }

  async onStartDirectConversation(payload: { userId: number; name: string }): Promise<void> {
    const created = await this.chatService.createConversation({
      name: payload.name,
      isGroup: false,
      memberUserIds: [payload.userId],
    });
    if (created) {
      await this.loadRealConversations();
      await this.selectConversation(created);
    }
  }

  async onCreateConversation(data: NewConversationData): Promise<void> {
    const created = await this.chatService.createConversation(data);
    if (created) {
      this.showNewConversation.set(false);
      await this.loadRealConversations();
      await this.selectConversation(created);
    }
  }

onMarkAsRead(): void {
    const conv = this.activeConversation();
    if (!conv) return;
    this.chatService.markAsRead(conv.id);
  }

  /** Modifie un message via le hub SignalR (temps réel). */
  onEditMessage(payload: { conversationId: string | number; messageId: string | number; text: string }): void {
    this.chatService.editMessageViaHub(payload.conversationId, payload.messageId, payload.text);
  }

  /** Supprime un message via le hub SignalR (temps réel). */
  onDeleteMessage(payload: { conversationId: string | number; messageId: string | number }): void {
    this.chatService.deleteMessageViaHub(payload.conversationId, payload.messageId);
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
}
