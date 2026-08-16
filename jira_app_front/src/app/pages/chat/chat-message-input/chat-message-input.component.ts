import { Component, Output, EventEmitter, ViewChild, ElementRef, signal, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface EmojiCategory {
  key: string;
  label: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    key: 'smileys',
    label: 'Smileys',
    emojis: ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤗', '🤔', '😅', '😉', '🙂', '😇', '🥳', '😴'],
  },
  {
    key: 'gestes',
    label: 'Gestes',
    emojis: ['👍', '👎', '👏', '🙏', '💪', '👌', '🤝', '✌️', '👋', '💯', '🙌', '🤞', '👀', '🙄', '👐', '🫶'],
  },
  {
    key: 'coeurs',
    label: 'Cœurs',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💖', '💔', '💕', '❤️‍🔥', '💗', '💓'],
  },
  {
    key: 'objets',
    label: 'Objets',
    emojis: ['📋', '🗂️', '📌', '📝', '💬', '📅', '⏰', '🔔', '💡', '🚀', '⚙️', '🧩', '🎯', '🏷️', '✅', '❌'],
  },
  {
    key: 'nature',
    label: 'Nature',
    emojis: ['🔥', '✨', '⭐', '🌈', '🌸', '🌍', '🌱', '🍀', '⚡', '💫', '🌙', '☀️', '🌊', '🍕', '☕', '🎉'],
  },
];

@Component({
  selector: 'app-chat-message-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-message-input.component.html',
  styles: ``,
})
export class ChatMessageInputComponent {
  @Input() isSending = false;

@Output() send = new EventEmitter<{ text: string; type: 'text' | 'file' | 'image'; fileName?: string; fileSize?: number; file?: File }>();
  @Output() typing = new EventEmitter<boolean>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('textInput') textInput!: ElementRef<HTMLInputElement>;

  text = '';
  showEmojiPicker = signal(false);
  activeEmojiCategory = 'smileys';
  emojiSearch = '';

  readonly emojiCategories = EMOJI_CATEGORIES;

  readonly filteredEmojis = computed(() => {
    const query = this.emojiSearch.trim().toLowerCase();
    if (query) {
      return EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((e) => e.includes(query));
    }
    return EMOJI_CATEGORIES.find((c) => c.key === this.activeEmojiCategory)?.emojis ?? [];
  });

  onKeydown(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  onInput(): void {
    this.typing.emit(true);
    // Debounce typing-off après 2.5s d'inactivité (stopTyping automatique).
    this.clearTypingTimer();
    this.typingTimer = window.setTimeout(() => this.typing.emit(false), 2500);
  }

  sendMessage(): void {
    if (this.isSending) return;
    const value = this.text.trim();
    if (!value) return;
    this.send.emit({ text: value, type: 'text' });
    this.text = '';
    this.clearTypingTimer();
    this.typing.emit(false);
  }

onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    this.send.emit({
      text: file.name,
      type: isImage ? 'image' : 'file',
      fileName: file.name,
      fileSize: file.size,
      file, // objet File réel transmis pour l'upload (POST /api/chat/upload)
    });
    input.value = '';
    // Stop typing immédiat à l'envoi d'une pièce jointe (comme pour un message texte).
    this.clearTypingTimer();
    this.typing.emit(false);
  }

  openFilePicker(): void {
    this.fileInput.nativeElement.click();
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker.update((v) => !v);
  }

  selectEmojiCategory(key: string): void {
    this.activeEmojiCategory = key;
  }

  /** Insère l'emoji à la position du curseur dans le champ de saisie. */
  addEmoji(emoji: string): void {
    const input = this.textInput?.nativeElement;
    const start = input && input.selectionStart != null ? input.selectionStart : this.text.length;
    const end = input && input.selectionEnd != null ? input.selectionEnd : start;

    this.text = this.text.slice(0, start) + emoji + this.text.slice(end);

    // Restaure le focus + la position du curseur après la mise à jour Angular.
    requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      const caret = start + emoji.length;
      input.setSelectionRange(caret, caret);
    });

    this.onInput();
  }

  private typingTimer: number | null = null;

  private clearTypingTimer(): void {
    if (this.typingTimer) {
      window.clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
  }
}
