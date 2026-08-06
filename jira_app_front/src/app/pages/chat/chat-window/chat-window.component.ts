import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessageInputComponent } from '../chat-message-input/chat-message-input.component';
import { ChatMessage, Conversation } from '../../../services/chat.service';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, ChatMessageInputComponent],
  templateUrl: './chat-window.component.html',
  styles: ``,
})
export class ChatWindowComponent implements AfterViewChecked {
  @Input() conversation: Conversation | null = null;
  @Input() messages: ChatMessage[] = [];
  @Input() online = false;
  @Input() typingUsers: Record<string, string> = {};
  @Input() currentUserId: string | number | null = null;

  @Output() sendMessage = new EventEmitter<{ text: string; type: 'text' | 'file' | 'image'; fileName?: string; fileSize?: number }>();
  @Output() typing = new EventEmitter<boolean>();
  @Output() markAsRead = new EventEmitter<void>();

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef<HTMLDivElement>;

  empty = signal(true);

  ngAfterViewChecked(): void {
    this.scrollToBottom();
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

  onTyping(typing: boolean): void {
    this.typing.emit(typing);
  }

  onSend(payload: { text: string; type: 'text' | 'file' | 'image'; fileName?: string; fileSize?: number }): void {
    this.sendMessage.emit(payload);
  }

  onContainerClick(): void {
    this.markAsRead.emit();
  }

  private scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch {
      /* ignore */
    }
  }
}
