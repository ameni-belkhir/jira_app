import { Injectable, inject } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  LogLevel,
} from '@microsoft/signalr';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/**
 * Modèle aligné sur le DTO backend `ChatMessageDto` :
 * { Id, ConversationId, SenderId, SenderName, SenderAvatar, Content, SentAt, AttachmentUrl, IsRead }
 */
export interface ChatMessage {
  id: string | number;
  conversationId: string | number;
  senderId: string | number;
  senderName?: string;
  senderAvatar?: string;
  /** Contenu (eq. backend `Content`). */
  text: string;
  timestamp: Date | string;
  isRead?: boolean;
  /** Surcharge UI : type de rendu (text/file/image). */
  type?: 'text' | 'file' | 'image';
  fileName?: string;
  fileSize?: number;
  /** Pièce jointe (URL, eq. backend `AttachmentUrl`). */
  attachmentUrl?: string;
}

/** Membre d'une conversation (eq. backend `ChatUserDto`). */
export interface ChatUser {
  id: string | number;
  nom: string;
  prenom: string;
  email: string;
  profileImageUrl?: string;
}

/**
 * Modèle aligné sur le DTO backend `ChatConversationDto` :
 * { Id, Name, IsGroup, ProjectId, CreatedAt, Members, LastMessage, UnreadCount }
 */
export interface Conversation {
  id: string | number;
  name: string;
  avatar?: string;
  isGroup?: boolean;
  projectId?: number | null;
  createdAt?: Date | string;
  members?: ChatUser[];
  lastMessage?: string;
  lastMessageAt?: Date | string;
  otherUserId?: string | number;
  unreadCount?: number;
  isOnline?: boolean;
  isTyping?: boolean;
  messages: ChatMessage[];
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.baseUrl.replace(/\/$/, '')}/api/chat`;

  /** Base SignalR hub URL for messaging. */
  private get hubUrl(): string {
    const configuredUrl = environment.signalrHubUrl?.trim();
    return configuredUrl
      ? configuredUrl.replace(/notifications\/?$/, 'chat')
      : `${environment.baseUrl.replace(/\/$/, '')}/hubs/chat`;
  }

  private hubConnection: HubConnection | null = null;

  /** userId (AuthService.getUserId) au moment de l'établissement de la connexion. */
  private connectedUserId: string | number | null = null;

  /** Current thread of messages (the active conversation). */
  private readonly messagesSubject = new BehaviorSubject<ChatMessage[]>([]);

  /** List of conversations (ordered by last message). */
  private readonly conversationsSubject = new BehaviorSubject<Conversation[]>([]);

  /** Map of userId -> displayName currently typing in the active conversation. */
  private readonly typingSubject = new BehaviorSubject<Record<string, string>>({});

  /** Délai de sécurité avant suppression forcée d'un utilisateur "en train d'écrire". */
  private readonly TYPING_TIMEOUT_MS = 3500;

  /** Timers par utilisateur : retire l'utilisateur si l'événement isTyping:false est manqué. */
  private typingTimers: Record<string, number> = {};

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

  // ==================== REST ====================

  /**
   * Charge les conversations de l'utilisateur depuis le backend
   * (GET /api/chat/conversations) et normalise le modèle backend vers l'UI.
   */
  async loadConversations(): Promise<Conversation[]> {
    try {
      const raw = await firstValueFrom(
        this.http.get<any[]>(`${this.apiUrl}/conversations`)
      );
      const normalized = (raw ?? []).map((c) => this.mapConversation(c));
      this.conversationsSubject.next(normalized);
      return normalized;
    } catch (err) {
      console.error('[ChatService] loadConversations failed: ', err);
      return this.getConversations();
    }
  }

  /**
   * Charge l'historique des messages d'une conversation
   * (GET /api/chat/conversations/{id}/messages) et met à jour le flux actif.
   */
  async loadMessages(conversationId: string | number): Promise<ChatMessage[]> {
    this.activeConversationId = conversationId;
    try {
      const raw = await firstValueFrom(
        this.http.get<any[]>(`${this.apiUrl}/conversations/${conversationId}/messages`)
      );
      const messages = (raw ?? []).map((m) => this.mapMessage(m));

      // Met à jour la conversation avec l'historique chargé.
      const convs = this.conversationsSubject.getValue().map((c) =>
        c.id === conversationId ? { ...c, messages } : c
      );
      this.conversationsSubject.next(convs);
      this.messagesSubject.next(messages);
      return messages;
    } catch (err) {
      console.error('[ChatService] loadMessages failed: ', err);
      return [];
    }
  }

  /**
   * Crée une conversation (1:1 ou groupe) via POST /api/chat/conversations.
   */
  async createConversation(payload: {
    name: string;
    isGroup: boolean;
    projectId?: number | null;
    memberUserIds: number[];
  }): Promise<Conversation | null> {
    try {
      const created = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/conversations`, payload)
      );
      const conv = this.mapConversation(created);
      const convs = [conv, ...this.conversationsSubject.getValue()];
      this.conversationsSubject.next(convs);
      return conv;
    } catch (err) {
      console.error('[ChatService] createConversation failed: ', err);
      return null;
    }
  }

  /**
   * Envoie une pièce jointe (fichier) et retourne son URL servie par le backend.
   * POST /api/chat/upload (multipart/form-data).
   */
  async uploadAttachment(file: File): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await firstValueFrom(
        this.http.post<{ url: string }>(`${this.apiUrl}/upload`, formData)
      );
      return res?.url ?? null;
    } catch (err) {
      console.error('[ChatService] uploadAttachment failed: ', err);
      return null;
    }
  }

  // ==================== NORMALISATION ====================

  /** Aligne un ChatConversationDto backend sur le modèle UI. */
  private mapConversation(raw: any): Conversation {
    const members = (raw.members ?? []) as ChatUser[];
    const currentUserId = this.authService.getUserId();
    const isGroup = !!raw.isGroup;

    // En 1:1, nom/avatar affichés = ceux de l'INTERLOCUTEUR, par filtrage
    // explicite sur currentUserId (jamais members[0] sans filtrage).
    // En groupe, on garde le nom et l'avatar du groupe fournis par le backend.
    const otherParticipant = members.find(
      (m: any) => String(m.id) !== String(currentUserId)
    );
    const otherName = otherParticipant
      ? [otherParticipant.prenom, otherParticipant.nom].filter(Boolean).join(' ').trim()
      : '';
    const displayName = !isGroup && otherParticipant
      ? otherName || otherParticipant.email || raw.name
      : raw.name;

    const last = raw.lastMessage;
    return {
      id: raw.id,
      name: displayName,
      isGroup,
      projectId: raw.projectId,
      createdAt: raw.createdAt,
      members,
      otherUserId: otherParticipant?.id,
      avatar: !isGroup
        ? (otherParticipant?.profileImageUrl ?? '')
        : (raw.avatar ?? ''),
      lastMessage: last?.content ?? last?.text ?? '',
      lastMessageAt: last?.sentAt ?? last?.timestamp,
      unreadCount: raw.unreadCount ?? 0,
      messages: [],
    };
  }

  /** Aligne un ChatMessageDto backend sur le modèle UI. */
  private mapMessage(raw: any): ChatMessage {
    return {
      id: raw.id,
      conversationId: raw.conversationId,
      senderId: raw.senderId,
      senderName: raw.senderName ?? 'Contact',
      senderAvatar: raw.senderAvatar,
      text: raw.content ?? raw.text ?? '',
      timestamp: raw.sentAt ?? raw.timestamp ?? new Date(),
      isRead: raw.isRead,
      type: raw.attachmentUrl ? (this.looksLikeImage(raw.attachmentUrl) ? 'image' : 'file') : 'text',
      fileName: raw.attachmentUrl?.split('/').pop(),
      attachmentUrl: raw.attachmentUrl,
    };
  }

  private looksLikeImage(url?: string): boolean {
    if (!url) return false;
    return /\.(png|jpe?g|gif|webp|svg|bmp)(\?|#|$)/i.test(url);
  }

  /**
   * Establishes the WebSocket connection to the chat hub with the JWT token.
   */
  startConnection(): void {
    const currentUserId = this.authService.getUserId();
    // La connexion existante est toujours celle du même utilisateur : on la garde.
    if (
      this.hubConnection?.state === HubConnectionState.Connected &&
      String(this.connectedUserId) === String(currentUserId)
    ) {
      return;
    }
    // Sécurité : une connexion Connected mais établie avec un AUTRE utilisateur
    // (changement de compte sans reload SPA) doit être fermée puis reconstruite,
    // sinon tous les appels au ChatHub utiliseraient les claims JWT de l'ancien user.
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
    // Payload backend : { conversationId, userId, userName, isTyping }
    this.hubConnection.on(
      'UserTypingStatus',
      (payload: {
        conversationId: string | number;
        userId: string | number;
        userName?: string;
        isTyping: boolean;
      }) => {
        this.handleTyping(payload.conversationId, payload.userId, payload.userName ?? '', payload.isTyping);
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

    // A message was edited (sender or Admin) — replace it in the local lists.
    this.hubConnection.on('MessageEdited', (message: any) => {
      this.handleMessageEdited(message);
    });

    // A message was deleted (sender or Admin) — remove it from the local lists.
    this.hubConnection.on('MessageDeleted', (conversationId, messageId) => {
      this.handleMessageDeleted(conversationId, messageId);
    });

    // À la reconnexion automatique, on re-entre dans la conversation active
    // pour continue à recevoir les événements temps réel.
    this.hubConnection.onreconnected(() => {
      console.log('[ChatService] Reconnected. Rejoining active conversation.');
      if (this.activeConversationId != null) {
        this.joinConversation(this.activeConversationId);
      }
    });

    this.hubConnection
      .start()
      .then(() => {
        console.log('[ChatService] Connected to chat hub.');
        this.connectedUserId = currentUserId;
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

  /**
   * Rejoint le groupe SignalR d'une conversation pour recevoir les événements
   * (messages, typing, lecture). Doit être appelé à l'ouverture d'une conversation.
   * Le backend refuse si l'utilisateur n'est pas membre.
   * Retourne la promesse d'invocation afin que l'appelant puisse attendre la
   * confirmation de l'enregistrement au groupe avant d'autoriser l'envoi.
   */
  joinConversation(conversationId: string | number): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      return Promise.resolve();
    }
    return this.hubConnection
      .invoke('JoinConversation', conversationId)
      .catch((err) => console.error('[ChatService] JoinConversation failed: ', err));
  }

  /** Quitte le groupe SignalR d'une conversation (à la fermeture). */
  leaveConversation(conversationId: string | number): void {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) return;
    this.hubConnection
      .invoke('LeaveConversation', conversationId)
      .catch((err) => console.error('[ChatService] LeaveConversation failed: ', err));
  }

  /**
   * Envoie un message via SignalR.
   * Pour une pièce jointe, l'appelant doit d'abord appeler `uploadAttachment(file)`
   * pour obtenir une URL, puis passer cette URL en `attachmentUrl`.
   */
  sendMessage(
    conversationId: string | number,
    text: string,
    type: 'text' | 'file' | 'image' = 'text',
    attachmentUrl?: string,
    fileName?: string,
    fileSize?: number,
  ): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      console.warn('[ChatService] Not connected, cannot send message.');
      return Promise.resolve();
    }
    // Backend signature: SendMessage(Guid conversationId, string content, string? attachmentUrl = null)
    return this.hubConnection
      .invoke('SendMessage', conversationId, text, attachmentUrl || undefined)
      .catch((err) => console.error('[ChatService] SendMessage failed: ', err));
  }

  /**
   * Modifie un message via SignalR (l'expéditeur ou l'Admin global).
   * Backend signature: EditMessage(Guid conversationId, Guid messageId, string content)
   */
  editMessageViaHub(
    conversationId: string | number,
    messageId: string | number,
    content: string,
  ): void {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      console.warn('[ChatService] Not connected, cannot edit message.');
      return;
    }
    this.hubConnection
      .invoke('EditMessage', conversationId, messageId, content)
      .catch((err) => console.error('[ChatService] EditMessage failed: ', err));
  }

  /**
   * Supprime un message via SignalR (l'expéditeur ou l'Admin global).
   * Backend signature: DeleteMessage(Guid conversationId, Guid messageId)
   */
  deleteMessageViaHub(conversationId: string | number, messageId: string | number): void {
    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      console.warn('[ChatService] Not connected, cannot delete message.');
      return;
    }
    this.hubConnection
      .invoke('DeleteMessage', conversationId, messageId)
      .catch((err) => console.error('[ChatService] DeleteMessage failed: ', err));
  }

  /**
   * Modifie un message via REST (PUT /api/chat/conversations/{id}/messages/{messageId}).
   */
  async editMessage(
    conversationId: string | number,
    messageId: string | number,
    content: string,
  ): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.put<any>(
          `${this.apiUrl}/conversations/${conversationId}/messages/${messageId}`,
          { content }
        )
      );
      return true;
    } catch (err) {
      console.error('[ChatService] editMessage failed: ', err);
      return false;
    }
  }

  /**
   * Supprime un message via REST (DELETE /api/chat/conversations/{id}/messages/{messageId}).
   */
  async deleteMessage(
    conversationId: string | number,
    messageId: string | number,
  ): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.delete<void>(
          `${this.apiUrl}/conversations/${conversationId}/messages/${messageId}`
        )
      );
      return true;
    } catch (err) {
      console.error('[ChatService] deleteMessage failed: ', err);
      return false;
    }
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
    // Toujours mettre à jour l'état local (badge + isRead) même hors-ligne.
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

    if (!this.hubConnection || this.hubConnection.state !== HubConnectionState.Connected) {
      return;
    }
    // Backend signature: MarkAsRead(Guid conversationId, Guid messageId)
    const conv = convs.find((c) => c.id === conversationId);
    const lastMessageId = conv?.messages?.length
      ? conv.messages[conv.messages.length - 1].id
      : conversationId;
    this.hubConnection
      .invoke('MarkAsRead', conversationId, lastMessageId)
      .catch((err) => console.error('[ChatService] MarkAsRead failed: ', err));
  }

  // ==================== HELPERS ====================

private handleIncomingMessage(message: any): void {
// Normalize the backend ChatMessageDto (content/sentAt/senderAvatar/attachmentUrl) into the UI shape.
    const attachmentUrl = message.attachmentUrl ?? undefined;
    const normalized: ChatMessage = {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderName: message.senderName ?? 'Contact',
      senderAvatar: message.senderAvatar,
      text: message.content ?? message.text ?? '',
      timestamp: message.sentAt ?? message.timestamp ?? new Date(),
      isRead: message.isRead,
      type: message.type
        ?? (attachmentUrl ? (this.looksLikeImage(attachmentUrl) ? 'image' : 'file') : 'text'),
      fileName: message.fileName ?? attachmentUrl?.split('/').pop(),
      fileSize: message.fileSize,
      attachmentUrl,
    };

    const convs = this.conversationsSubject.getValue();
    let conv = convs.find((c) => c.id === normalized.conversationId);

    if (!conv) {
      // Nouvelle conversation inconnue (1:1) : l'interlocuteur est l'expéditeur.
      conv = {
        id: normalized.conversationId,
        name: normalized.senderName ?? 'Contact',
        messages: [],
        unreadCount: 0,
        isGroup: false,
        otherUserId: normalized.senderId,
        avatar: normalized.senderAvatar ?? '',
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
      // Déduplication par id : évite d'afficher deux fois un message déjà connu
      // (ex: écho SignalR du serveur après envoi + rechargement REST).
      messages: this.upsertMessage(conv.messages, normalized),
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

  private handleTyping(
    conversationId: string | number,
    userId: string | number,
    userName: string,
    isTyping: boolean,
  ): void {
    if (conversationId !== this.activeConversationId) return;

    const current = { ...this.typingSubject.getValue() };
    const key = String(userId);

    if (isTyping) {
      current[key] = userName || 'Quelqu\u2019un';
      // Filet de sécurité : retire l'utilisateur après 3.5s si l'événement isTyping:false est perdu.
      this.scheduleTypingTimeout(key);
    } else {
      delete current[key];
      this.clearTypingTimeout(key);
    }
    this.typingSubject.next(current);

    const stillTyping = Object.keys(current).length > 0;
    const convs = this.conversationsSubject.getValue().map((c) =>
      c.id === conversationId ? { ...c, isTyping: stillTyping } : c
    );
    this.conversationsSubject.next(convs);
  }

  /** Planifie la suppression forcée de l'utilisateur des "en train d'écrire" (reset à chaque événement isTyping:true). */
  private scheduleTypingTimeout(userKey: string): void {
    this.clearTypingTimeout(userKey);
    this.typingTimers[userKey] = window.setTimeout(() => {
      delete this.typingTimers[userKey];
      const current = { ...this.typingSubject.getValue() };
      if (current[userKey]) {
        delete current[userKey];
        this.typingSubject.next(current);
        const convs = this.conversationsSubject.getValue().map((c) =>
          String(c.id) === String(this.activeConversationId)
            ? { ...c, isTyping: Object.keys(current).length > 0 }
            : c
        );
        this.conversationsSubject.next(convs);
      }
    }, this.TYPING_TIMEOUT_MS);
  }

  private clearTypingTimeout(userKey: string): void {
    const timer = this.typingTimers[userKey];
    if (timer != null) {
      window.clearTimeout(timer);
      delete this.typingTimers[userKey];
    }
  }

  /** Insert ou remplace un message dans la liste, dédupliqué par id. */
  private upsertMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
    const index = messages.findIndex((m) => String(m.id) === String(message.id));
    if (index >= 0) {
      const copy = [...messages];
      copy[index] = message;
      return copy;
    }
    return [...messages, message];
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

  private handleMessageEdited(message: any): void {
    const normalized = this.mapMessage(message);
    const convs = this.conversationsSubject.getValue().map((c) => {
      if (String(c.id) !== String(normalized.conversationId)) return c;
      const messages = c.messages.map((m) =>
        String(m.id) === String(normalized.id) ? normalized : m
      );
      const last = messages[messages.length - 1];
      return {
        ...c,
        messages,
        lastMessage: last?.text ?? c.lastMessage,
        lastMessageAt: last?.timestamp ?? c.lastMessageAt,
      };
    });
    this.conversationsSubject.next(convs);

    if (String(this.activeConversationId) === String(normalized.conversationId)) {
      const conv = convs.find((c) => String(c.id) === String(normalized.conversationId));
      this.messagesSubject.next(conv?.messages ?? []);
    }
  }

  private handleMessageDeleted(conversationId: string | number, messageId: string | number): void {
    const convs = this.conversationsSubject.getValue().map((c) => {
      if (String(c.id) !== String(conversationId)) return c;
      const messages = c.messages.filter((m) => String(m.id) !== String(messageId));
      const last = messages[messages.length - 1];
      return {
        ...c,
        messages,
        lastMessage: last?.text ?? '',
        lastMessageAt: last?.timestamp ?? c.lastMessageAt,
      };
    });
    this.conversationsSubject.next(convs);

    if (String(this.activeConversationId) === String(conversationId)) {
      const conv = convs.find((c) => String(c.id) === String(conversationId));
      this.messagesSubject.next(conv?.messages ?? []);
    }
  }
}
