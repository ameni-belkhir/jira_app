import { Injectable, inject } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  LogLevel,
} from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/** A single chat message in a conversation. */
export interface ChatMessage {
  id: string | number;
  conversationId: string | number;
  senderId: string | number;
  senderName?: string;
  text: string;
  timestamp: Date | string;
  isRead?: boolean;
  type?: 'text' | 'file' | 'image';
  fileName?: string;
  fileSize?: number;
}

/** A conversation (private or group). */
export interface Conversation {
  id: string | number;
  name: string;
  avatar?: string;
  otherUserId?: string | number;
  lastMessage?: string;
  lastMessageAt?: Date | string;
  unreadCount?: number;
  isOnline?: boolean;
  isTyping?: boolean;
  messages: ChatMessage[];
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private authService = inject(AuthService);

  /** Base SignalR hub URL for messaging. */
  private get hubUrl(): string {
    const configuredUrl = environment.signalrHubUrl?.trim();
    return configuredUrl
      ? configuredUrl.replace(/notifications\/?$/, 'chat')
      : `${environment.baseUrl.replace(/\/$/, '')}/hubs/chat`;
  }

  private hubConnection: HubConnection | null = null;

  /** Current thread of messages (the active conversation). */
  private readonly messagesSubject = new BehaviorSubject<ChatMessage[]>([]);

  /** List of conversations (ordered by last message). */
  private readonly conversationsSubject = new BehaviorSubject<Conversation[]>([]);

  /** Map of userId -> displayName currently typing in the active conversation. */
  private readonly typingSubject = new BehaviorSubject<Record<string, string>>({});

  /** Map of userId -> online status. */
  private readonly onlineSubject = new BehaviorSubject<Record<string, boolean>>({});

  /** Observable of the active conversation messages. */
  readonly messages$ = this.messagesSubject.asObservable();

  /** Observable of all conversations. */
  readonly activeConversations$ = this.conversationsSubject.asObservable();

  /** Observable of currently-typing users. */
  readonly typingUsers$ = this.typingSubject.asObservable();

  /** Observable of online users. */
  readonly onlineUsers$ = this.onlineSubject.asObservable();

  private activeConversationId: string | number | null = null;

  /** Current connection state. */
  get connectionState(): HubConnectionState {
    return this.hubConnection?.state ?? HubConnectionState.Disconnected;
  }

  /** Snapshot helpers. */
  getMessages(): ChatMessage[] {
    return this.messagesSubject.getValue();
  }

  getConversations(): Conversation[] {
    return this.conversationsSubject.getValue();
  }

  getOnlineUsers(): Record<string, boolean> {
    return this.onlineSubject.getValue();
  }

  getTypingUsers(): Record<string, string> {
    return this.typingSubject.getValue();
  }

  /** Select the active conversation and load its messages. */
  setActiveConversation(conversationId: string | number | null): void {
    this.activeConversationId = conversationId;
    const conv = this.conversationsSubject
      .getValue()
      .find((c) => c.id === conversationId);
    this.messagesSubject.next(conv?.messages ?? []);
  }

  /** Seed conversations (e.g. from a REST endpoint or mock). */
  setConversations(conversations: Conversation[]): void {
    this.conversationsSubject.next(conversations);
  }

  /**
   * Establishes the WebSocket connection to the chat hub with the JWT token.
   */
  startConnection(): void {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      return;
    }
    if (this.hubConnection) {
      this.stopConnection();
    }

    this.hubConnection = new HubConnectionBuilder()
      .withUrl(this.hubUrl, {
        accessTokenFactory: () => this.authService.getToken() ?? '',
        withCredentials: true,
        skipNegotiation: false,
        transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();

    // Incoming direct/group message
    this.hubConnection.on('ReceiveMessage', (message: ChatMessage) => {
      this.handleIncomingMessage(message);
    });

// A user is typing in a conversation
    this.hubConnection.on(
      'UserTypingStatus',
      (conversationId: string | number, userId: string | number, isTyping: boolean) => {
        this.handleTyping(conversationId, userId, isTyping);
      }
    );

    // Presence: user online/offline
    this.hubConnection.on('UserPresenceChanged', (userId, isOnline) => {
      this.handleOnline(userId, isOnline);
    });

    // Others marked messages as read
    this.hubConnection.on('MessagesRead', (conversationId) => {
      this.handleMarkedAsRead(conversationId);
    });

    this.hubConnection
      .start()
      .then(() => {
        console.log('[ChatService] Connected to chat hub.');
      })
      .catch((err) => {
        console.error('[ChatService] Connection failed: ', err);
      });
  }

  /** Gracefully stops the hub connection. */
  stopConnection(): void {
    if (this.hubConnection && this.hubConnection.state !== HubConnectionState.Disconnected) {
      this.hubConnection
        .stop()
        .catch((err) => console.error('[ChatService] Error stopping connection: ', err));
    }
    this.hubConnection = null;
  }

/** Send a message to the given conversation. */
  sendMessage(conversationId: string | number, text: string, type: 'text' | 'file' | 'image' = 'text', fileName?: string, fileSize?: number): void {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      console.warn('[ChatService] Not connected, cannot send message.');
      return;
    }
    // Backend signature: SendMessage(Guid conversationId, string content, string? attachmentUrl = null)
    const attachmentUrl = fileName || undefined;
    this.hubConnection
      .invoke('SendMessage', conversationId, text, attachmentUrl)
      .catch((err) => console.error('[ChatService] SendMessage failed: ', err));
  }

/** Notify the recipient(s) that the current user is typing. */
  sendTyping(conversationId: string | number, isTyping: boolean): void {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      return;
    }
    const method = isTyping ? 'StartTyping' : 'StopTyping';
    this.hubConnection
      .invoke(method, conversationId)
      .catch((err) => console.error(`[ChatService] ${method} failed: `, err));
  }

/** Mark all messages in a conversation as read. */
  markAsRead(conversationId: string | number): void {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      return;
    }
    // Backend signature: MarkAsRead(Guid conversationId, Guid messageId)
    const conv = this.conversationsSubject.getValue().find((c) => c.id === conversationId);
    const lastMessageId = conv?.messages?.length
      ? conv.messages[conv.messages.length - 1].id
      : conversationId;
    this.hubConnection
      .invoke('MarkAsRead', conversationId, lastMessageId)
      .catch((err) => console.error('[ChatService] MarkAsRead failed: ', err));

    // Update local read state + clear unread badge.
    const convs = this.conversationsSubject.getValue().map((c) =>
      c.id === conversationId
        ? {
            ...c,
            unreadCount: 0,
            messages: c.messages.map((m) => ({ ...m, isRead: true })),
          }
        : c
    );
    this.conversationsSubject.next(convs);
    if (this.activeConversationId === conversationId) {
      const conv = convs.find((c) => c.id === conversationId);
      this.messagesSubject.next(conv?.messages ?? []);
    }
  }

  // ==================== HELPERS ====================

private handleIncomingMessage(message: any): void {
    // Normalize the backend ChatMessageDto (content/sentAt/senderAvatar) into the UI shape.
    const normalized: ChatMessage = {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: message.senderName ?? 'Contact',
      text: message.content ?? message.text ?? '',
      timestamp: message.sentAt ?? message.timestamp ?? new Date(),
      isRead: message.isRead,
      type: message.type ?? 'text',
      fileName: message.fileName,
      fileSize: message.fileSize,
    };

    const convs = this.conversationsSubject.getValue();
    let conv = convs.find((c) => c.id === normalized.conversationId);

    if (!conv) {
      // New conversation from an unknown sender.
      conv = {
        id: normalized.conversationId,
        name: normalized.senderName ?? 'Contact',
        messages: [],
        unreadCount: 0,
      };
      convs.unshift(conv);
    }

    const isActive = this.activeConversationId === conv.id;
    conv = {
      ...conv,
      lastMessage: normalized.text,
      lastMessageAt: normalized.timestamp,
      isOnline: this.onlineSubject.getValue()[String(normalized.senderId)] ?? conv.isOnline,
      unreadCount: isActive ? 0 : (conv.unreadCount ?? 0) + 1,
      messages: [...conv.messages, normalized],
    };

    const idx = convs.findIndex((c) => c.id === conv.id);
    if (idx >= 0) {
      convs[idx] = conv;
    }

    // Sort conversations by most recent first.
    convs.sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });

    this.conversationsSubject.next(convs);

    if (isActive) {
      this.messagesSubject.next(conv.messages);
    }
  }

private handleTyping(conversationId: string | number, userId: string | number, isTyping: boolean): void {
    if (conversationId !== this.activeConversationId) return;

    const current = { ...this.typingSubject.getValue() };
    const key = String(userId);
    if (isTyping) {
      current[key] = 'Quelqu\u2019un';
    } else {
      delete current[key];
    }
    this.typingSubject.next(current);

    // Also reflect on the conversation row.
    const convs = this.conversationsSubject.getValue().map((c) =>
      c.id === conversationId ? { ...c, isTyping: !!isTyping } : c
    );
    this.conversationsSubject.next(convs);
  }

  private handleOnline(userId: string | number, isOnline: boolean): void {
    const current = { ...this.onlineSubject.getValue() };
    current[String(userId)] = !!isOnline;
    this.onlineSubject.next(current);

    const convs = this.conversationsSubject.getValue().map((c) =>
      c.otherUserId === userId ? { ...c, isOnline: !!isOnline } : c
    );
    this.conversationsSubject.next(convs);
  }

  private handleMarkedAsRead(conversationId: string | number): void {
    const convs = this.conversationsSubject.getValue().map((c) =>
      c.id === conversationId
        ? { ...c, messages: c.messages.map((m) => ({ ...m, isRead: true })) }
        : c
    );
    this.conversationsSubject.next(convs);
    if (this.activeConversationId === conversationId) {
      const conv = convs.find((c) => c.id === conversationId);
      this.messagesSubject.next(conv?.messages ?? []);
    }
  }
}
