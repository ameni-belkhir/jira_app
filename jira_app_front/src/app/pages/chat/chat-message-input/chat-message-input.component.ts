import { Component, Output, EventEmitter, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

const EMOJIS: string[] = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤗', '🤔',
  '😅', '😉', '🙂', '👍', '👎', '👏', '🙏', '💪', '🔥', '❤️',
  '🎉', '✨', '🚀', '✅', '❌', '💡', '📌', '📝', '💬', '👌',
];

@Component({
  selector: 'app-chat-message-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-message-input.component.html',
  styles: ``,
})
export class ChatMessageInputComponent {
  @Output() send = new EventEmitter<{ text: string; type: 'text' | 'file' | 'image'; fileName?: string; fileSize?: number }>();
  @Output() typing = new EventEmitter<boolean>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  text = '';
  showEmojiPicker = signal(false);

  readonly emojis = EMOJIS;

  onKeydown(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  onInput(): void {
    this.typing.emit(true);
    // Debounce typing-off after 1.2s of inactivity.
    this.clearTypingTimer();
    this.typingTimer = window.setTimeout(() => this.typing.emit(false), 1200);
  }

  sendMessage(): void {
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
    });
    input.value = '';
  }

  openFilePicker(): void {
    this.fileInput.nativeElement.click();
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker.update((v) => !v);
  }

  addEmoji(emoji: string): void {
    this.text += emoji;
    this.showEmojiPicker.set(false);
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
