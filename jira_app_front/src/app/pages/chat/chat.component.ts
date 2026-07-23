import { Component, ElementRef, ViewChild, AfterViewChecked, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Message {
  id: number;
  senderId: number;
  text: string;
  timestamp: Date;
  read: boolean;
}

interface Conversation {
  id: number;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  online: boolean;
  messages: Message[];
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styles: ``
})
export class ChatComponent implements AfterViewChecked {
  @ViewChild('messageContainer') private messageContainer!: ElementRef;

  searchTerm = '';
  newMessage = '';
  activeConversation = signal<Conversation | null>(null);

  conversations: Conversation[] = [
    {
      id: 1, name: 'Emily Chen', avatar: '/images/user/user-01.jpg',
      lastMessage: 'Sure, I will review the PR today', time: '2 min ago', online: true,
      messages: [
        { id: 1, senderId: 1, text: 'Hey, have you seen the latest design mockups?', timestamp: new Date('2026-07-21T10:00:00'), read: true },
        { id: 2, senderId: 0, text: 'Not yet, can you send me the link?', timestamp: new Date('2026-07-21T10:02:00'), read: true },
        { id: 3, senderId: 1, text: 'Sure, I will review the PR today', timestamp: new Date('2026-07-21T10:05:00'), read: true },
      ]
    },
    {
      id: 2, name: 'Alex Rivera', avatar: '/images/user/user-02.jpg',
      lastMessage: 'Deploy is scheduled for tomorrow', time: '15 min ago', online: true,
      messages: [
        { id: 1, senderId: 2, text: 'The CI pipeline is ready', timestamp: new Date('2026-07-21T09:30:00'), read: true },
        { id: 2, senderId: 0, text: 'Great, any issues?', timestamp: new Date('2026-07-21T09:32:00'), read: true },
        { id: 3, senderId: 2, text: 'Deploy is scheduled for tomorrow', timestamp: new Date('2026-07-21T09:35:00'), read: false },
      ]
    },
    {
      id: 3, name: 'Sarah Kim', avatar: '/images/user/user-03.jpg',
      lastMessage: 'API docs are ready for review', time: '1 hour ago', online: false,
      messages: [
        { id: 1, senderId: 3, text: 'I finished the documentation', timestamp: new Date('2026-07-21T08:00:00'), read: true },
        { id: 2, senderId: 0, text: 'Awesome, I will check it out', timestamp: new Date('2026-07-21T08:15:00'), read: true },
        { id: 3, senderId: 3, text: 'API docs are ready for review', timestamp: new Date('2026-07-21T08:30:00'), read: true },
      ]
    },
    {
      id: 4, name: 'James Wilson', avatar: '/images/user/user-04.jpg',
      lastMessage: 'Authentication module is complete', time: '3 hours ago', online: false,
      messages: [
        { id: 1, senderId: 4, text: 'JWT auth is fully implemented', timestamp: new Date('2026-07-21T06:00:00'), read: true },
        { id: 2, senderId: 0, text: 'Nice work! Let us test it', timestamp: new Date('2026-07-21T06:30:00'), read: true },
        { id: 3, senderId: 4, text: 'Authentication module is complete', timestamp: new Date('2026-07-21T07:00:00'), read: true },
      ]
    },
  ];

  get filteredConversations(): Conversation[] {
    if (this.searchTerm.trim() === '') return this.conversations;
    const term = this.searchTerm.toLowerCase();
    return this.conversations.filter(c => c.name.toLowerCase().includes(term));
  }

  selectConversation(conv: Conversation): void {
    this.activeConversation.set(conv);
  }

  sendMessage(): void {
    const conv = this.activeConversation();
    if (conv == null || this.newMessage.trim() === '') return;

    conv.messages.push({
      id: Date.now(),
      senderId: 0,
      text: this.newMessage.trim(),
      timestamp: new Date(),
      read: true
    });
    conv.lastMessage = this.newMessage.trim();
    conv.time = 'just now';
    this.newMessage = '';
    this.activeConversation.set({ ...conv });
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
    } catch(e) { }
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  isOwnMessage(msg: Message): boolean {
    return msg.senderId === 0;
  }

  isOtherMessage(msg: Message): boolean {
    return msg.senderId !== 0;
  }

  getMessageClasses(msg: Message): string {
    if (this.isOwnMessage(msg)) {
      return 'px-4 py-2.5 rounded-2xl text-sm leading-5 bg-brand-500 text-white rounded-br-md';
    }
    return 'px-4 py-2.5 rounded-2xl text-sm leading-5 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white/90 rounded-bl-md';
  }
}
