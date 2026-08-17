import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  signal,
  inject,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatMessageInputComponent } from '../chat-message-input/chat-message-input.component';
import { ChatMessageComponent } from '../chat-message/chat-message.component';
import { ChatMessage, ChatUser, Conversation } from '../../../services/chat.service';
import { environment } from '../../../../environments/environment';
import { ChatThemeService, CHAT_THEMES, ChatThemeId } from '../../../shared/services/chat-theme.service';

/** Couleurs personnalisables des bulles de messages sortants. */
export type ChatBubbleColorId = 'indigo' | 'violet' | 'emerald' | 'rose';

export interface ChatBubbleColorOption {
  id: ChatBubbleColorId;
  label: string;
  /** Aperçu CSS injecté dans la puce du sélecteur. */
  swatch: string;
  /** Classes Tailwind littérales (détectées par Tailwind 4) du fond des bulles sortantes. */
  classes: string;
}

export const CHAT_BUBBLE_COLORS: ChatBubbleColorOption[] = [
  { id: 'indigo', label: 'Bleu Indigo', swatch: 'background-color:#465fff', classes: 'bg-indigo-600 text-white' },
  { id: 'violet', label: 'Violet', swatch: 'background-color:#7c3aed', classes: 'bg-violet-600 text-white' },
  { id: 'emerald', label: 'Vert Émeraude', swatch: 'background-color:#059669', classes: 'bg-emerald-600 text-white' },
  { id: 'rose', label: 'Rose Gold', swatch: 'background-color:#f43f5e', classes: 'bg-rose-500 text-white' },
];

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatMessageInputComponent, ChatMessageComponent],
  templateUrl: './chat-window.component.html',
  styles: ``,
})
export class ChatWindowComponent implements AfterViewChecked, OnChanges {
  @Input() conversation: Conversation | null = null;
  @Input() messages: ChatMessage[] = [];
  @Input() online = false;
  @Input() typingUsers: Record<string, string> = {};
  @Input() currentUserId: string | number | null = null;
  /** L'Admin global peut modifier/supprimer n'importe quel message. */
  @Input() isAdmin = false;
  /** Verrou anti-envoi multiple (remonté depuis la page). */
  @Input() isSending = false;

  @Output() sendMessage = new EventEmitter<{ text: string; type: 'text' | 'file' | 'image'; fileName?: string; fileSize?: number; file?: File }>();
  @Output() typing = new EventEmitter<boolean>();
  @Output() markAsRead = new EventEmitter<void>();
  @Output() editMessage = new EventEmitter<{ conversationId: string | number; messageId: string | number; text: string }>();
  @Output() deleteMessage = new EventEmitter<{ conversationId: string | number; messageId: string | number }>();

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef<HTMLDivElement>;

  /** Thème du fond de discussion. */
  private chatThemeService = inject(ChatThemeService);
  readonly chatThemes = CHAT_THEMES;
  readonly chatBubbleColors = CHAT_BUBBLE_COLORS;
  showThemePicker = signal(false);
  showBubblePicker = signal(false);

  /** Couleur des bulles sortantes, persistée par conversation (localStorage). */
  bubbleColorId = signal<ChatBubbleColorId>('indigo');
  private readonly BUBBLE_STORAGE_PREFIX = 'chat-bubble-color';

  /** Message dont la suppression est en cours de confirmation (modal). */
  confirmDeleteMessageId: string | number | null = null;

  /** Fallback d'avatar de l'en-tête de conversation. */
  private readonly headerAvatarFailedState = signal(false);
  readonly headerAvatarFailed = this.headerAvatarFailedState.asReadonly();

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Recharge la couleur de bulle mémorisée à chaque changement de conversation.
    if (changes['conversation']) {
      const stored = localStorage.getItem(this.bubbleStorageKey()) as ChatBubbleColorId | null;
      this.bubbleColorId.set(
        stored && CHAT_BUBBLE_COLORS.some((c) => c.id === stored) ? stored : 'indigo'
      );
    }
  }

  get typingText(): string {
    const names = Object.values(this.typingUsers);
    if (names.length === 0) return '';
    if (names.length === 1) return `${names[0]} est en train d\u2019écrire…`;
    return 'Plusieurs personnes sont en train d\u2019écrire…';
  }

  isOwn(msg: ChatMessage): boolean {
    return this.currentUserId != null && String(msg.senderId) === String(this.currentUserId);
  }

  // ==================== Couleur des bulles sortantes ====================

  bubbleClasses(): string {
    return (
      CHAT_BUBBLE_COLORS.find((c) => c.id === this.bubbleColorId())?.classes ??
      'bg-indigo-600 text-white'
    );
  }

  setBubbleColor(id: ChatBubbleColorId): void {
    this.bubbleColorId.set(id);
    localStorage.setItem(this.bubbleStorageKey(), id);
  }

  private bubbleStorageKey(): string {
    return this.conversation
      ? `${this.BUBBLE_STORAGE_PREFIX}-${this.conversation.id}`
      : this.BUBBLE_STORAGE_PREFIX;
  }

  // ==================== Interlocuteur & en-tête de la conversation ====================

  /**
   * En 1:1 uniquement : le membre de la conversation QUI N'EST PAS l'utilisateur
   * connecté (filtrage explicite). Retourne undefined en groupe (plusieurs "autres"
   * membres) — l'en-tête garde alors le nom/avatar du groupe.
   */
  otherParticipant(): ChatUser | undefined {
    if (!this.conversation || this.conversation.isGroup) return undefined;
    if (this.currentUserId == null) return undefined;
    return this.conversation.members?.find(
      (m) => String(m.id) !== String(this.currentUserId)
    );
  }

  /** Nom affiché dans l'en-tête : l'interlocuteur en 1:1, sinon le nom du groupe. */
  headerDisplayName(): string {
    if (this.conversation?.isGroup) return this.conversation.name ?? '';
    const other = this.otherParticipant();
    if (other) {
      const full = [other.prenom, other.nom].filter(Boolean).join(' ').trim();
      if (full) return full;
      if (other.email) return other.email;
    }
    return this.conversation?.name ?? '';
  }

  conversationAvatarUrl(): string {
    const raw = this.conversation?.isGroup
      ? (this.conversation.avatar ?? '')
      : (this.otherParticipant()?.profileImageUrl ?? this.conversation?.avatar ?? '');
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${environment.baseUrl.replace(/\/$/, '')}${raw.startsWith('/') ? raw : `/${raw}`}`;
  }

  conversationInitials(): string {
    const name = this.headerDisplayName().trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
    return (first + second).toUpperCase() || '?';
  }

  onHeaderAvatarError(): void {
    this.headerAvatarFailedState.set(true);
  }

  // ==================== Thème du fond ====================

  chatBgClass(theme: ChatThemeId): string {
    switch (theme) {
      case 'gradient-dark': return 'chat-bg-gradient-dark';
      case 'starry-night': return 'chat-bg-starry';
      case 'slate': return 'chat-bg-slate';
      case 'gradient-light': return 'chat-bg-gradient-light';
      case 'coral-sunset': return 'chat-bg-coral-sunset';
      case 'ocean-breeze': return 'chat-bg-ocean-breeze';
      case 'lavender-dreams': return 'chat-bg-lavender-dreams';
      case 'mint-fresh': return 'chat-bg-mint-fresh';
      case 'aurora': return 'chat-bg-aurora';
      case 'trello':
      default: return 'chat-bg-trello';
    }
  }

  currentTheme(): ChatThemeId {
    return this.chatThemeService.getTheme();
  }

  toggleThemePicker(): void {
    this.showThemePicker.update((v) => !v);
  }

  toggleBubblePicker(): void {
    this.showBubblePicker.update((v) => !v);
  }

  setChatTheme(theme: ChatThemeId): void {
    this.chatThemeService.setTheme(theme);
    this.showThemePicker.set(false);
  }

  // ==================== Événements remontés ====================

  onTyping(typing: boolean): void {
    this.typing.emit(typing);
  }

  onSend(payload: { text: string; type: 'text' | 'file' | 'image'; fileName?: string; fileSize?: number; file?: File }): void {
    this.sendMessage.emit(payload);
  }

  onContainerClick(): void {
    this.markAsRead.emit();
  }

  onMessageEdit(payload: { conversationId: string | number; messageId: string | number; text: string }): void {
    this.editMessage.emit(payload);
  }

  onDeleteRequest(payload: { conversationId: string | number; messageId: string | number }): void {
    this.confirmDeleteMessageId = payload.messageId;
  }

  cancelDelete(): void {
    this.confirmDeleteMessageId = null;
  }

  confirmDelete(): void {
    if (this.confirmDeleteMessageId == null || !this.conversation) return;
    const messageId = this.confirmDeleteMessageId;
    this.confirmDeleteMessageId = null;
    this.deleteMessage.emit({ conversationId: this.conversation.id, messageId });
  }

  private scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch {
      /* ignore */
    }
  }
}
