import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { ChatMessage, ChatUser, Conversation } from '../../../services/chat.service';

/**
 * Bulle de message unique.
 * - Alignement : messages sortants à droite (flex-row-reverse), entrant à gauche (flex-row).
 * - Avatar : fallback pastille d'initiales si l'URL est absente/invalide, URL préfixée par l'API si relative.
 * - Couleur des bulles sortantes personnalisable (classes Tailwind littérales transmises par le parent).
 */
@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-message.component.html',
  styles: ``,
})
export class ChatMessageComponent implements OnChanges {
  @Input({ required: true }) message!: ChatMessage;
  /** true si le message appartient à l'utilisateur connecté. */
  @Input() isOwn = false;
  /** L'Admin global peut modifier/supprimer n'importe quel message. */
  @Input() isAdmin = false;
  @Input() conversation: Conversation | null = null;
  /** Identifiant de l'utilisateur connecté (fourni par le parent, jamais modifié ici). */
  @Input() currentUserId: string | number | null = null;
  /** Classes Tailwind (littérales) du fond des bulles sortantes. */
  @Input() bubbleColor = 'bg-indigo-600 text-white';

  /** Demande de sauvegarde d'une édition (texte modifié). */
  @Output() edit = new EventEmitter<{ conversationId: string | number; messageId: string | number; text: string }>();
  /** Demande de suppression (le modal de confirmation reste géré par le parent). */
  @Output() deleteRequest = new EventEmitter<{ conversationId: string | number; messageId: string | number }>();

  /** Édition en ligne gérée localement. */
  editing = false;
  editText = '';

  /** true si l'avatar a échoué au chargement (fallback initiales). */
  private readonly avatarFailedState = signal(false);
  readonly avatarFailed = this.avatarFailedState.asReadonly();

  /**
   * Réinitialise l'état d'échec de l'avatar quand le composant est réutilisé
   * pour un autre message / une autre conversation (recyclage @for).
   */
  ngOnChanges(changes: SimpleChanges): void {
    const messageChanged =
      changes['message'] && changes['message'].previousValue?.id !== changes['message'].currentValue?.id;
    const conversationChanged =
      changes['conversation'] &&
      changes['conversation'].previousValue?.id !== changes['conversation'].currentValue?.id;
    if (messageChanged || conversationChanged) {
      this.avatarFailedState.set(false);
    }
  }

  // ==================== Affichage ====================

  /**
   * Membre de la conversation associé à l'expéditeur.
   * - Message sortant : l'utilisateur courant (via currentUserId).
   * - Message entrant : le membre correspondant à senderId.
   */
  private resolveSenderMember(): ChatUser | undefined {
    const id = this.isOwn ? this.currentUserId : this.message.senderId;
    if (id == null) return undefined;
    return this.conversation?.members?.find((m) => String(m.id) === String(id));
  }

  senderName(): string {
    const name = this.message.senderName;
    if (name && name !== 'Contact' && name !== 'Utilisateur' && name !== 'Utilisateur inconnu') {
      return name;
    }
    const member = this.resolveSenderMember();
    if (member) {
      const fullName = [member.prenom, member.nom].filter(Boolean).join(' ').trim();
      if (fullName) return fullName;
      if (member.email) return member.email;
    }
    // En groupe, on n'affiche jamais le nom de la conversation à la place d'une personne.
    if (this.conversation?.isGroup) return 'Utilisateur inconnu';
    return this.conversation?.name ?? 'Contact';
  }

  /**
   * URL de l'avatar : préfixée par l'URL de base de l'API si le chemin est relatif.
   * - Message sortant : avatar de l'utilisateur courant (pas celui de l'interlocuteur).
   * - Message entrant : avatar de l'expéditeur, sinon avatar de la conversation (légitime en 1:1).
   */
  avatarUrl(): string {
    let raw = this.message.senderAvatar || '';
    if (!raw) {
      const member = this.resolveSenderMember();
      raw = member?.profileImageUrl ?? '';
    }
    if (!raw && !this.isOwn) {
      raw = this.conversation?.avatar ?? '';
    }
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${environment.baseUrl.replace(/\/$/, '')}${raw.startsWith('/') ? raw : `/${raw}`}`;
  }

  /** Initiales à partir du nom (ex: "ameni belkhir" -> "AB"). */
  initials(): string {
    const name = this.senderName().trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
    return (first + second).toUpperCase() || '?';
  }

  /** Pastille de couleur stable pour un expéditeur (classes littérales détectées par Tailwind 4). */
  avatarPalette(): string {
    const colors = [
      'bg-brand-500',
      'bg-violet-500',
      'bg-emerald-500',
      'bg-rose-500',
      'bg-amber-500',
      'bg-cyan-500',
    ];
    let hash = 0;
    for (const ch of String(this.message.senderId ?? '')) {
      hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    }
    return colors[Math.abs(hash) % colors.length];
  }

  avatarSize(): string {
    return this.isOwn ? 'h-7 w-7 text-[10px]' : 'h-8 w-8 text-xs';
  }

  onAvatarError(): void {
    this.avatarFailedState.set(true);
  }

  canEdit(): boolean {
    return this.isAdmin || this.isOwn;
  }

  canDelete(): boolean {
    return this.isAdmin || this.isOwn;
  }

  formatTime(value: Date | string): string {
    const d = new Date(value);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatFileSize(bytes?: number): string {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ==================== Actions ====================

  startEdit(): void {
    this.editing = true;
    this.editText = this.message.text;
  }

  cancelEdit(): void {
    this.editing = false;
  }

  saveEdit(): void {
    const text = this.editText.trim();
    if (!text || text === this.message.text) {
      this.cancelEdit();
      return;
    }
    this.editing = false;
    this.edit.emit({ conversationId: this.message.conversationId, messageId: this.message.id, text });
  }

  requestDelete(): void {
    this.deleteRequest.emit({ conversationId: this.message.conversationId, messageId: this.message.id });
  }
}
