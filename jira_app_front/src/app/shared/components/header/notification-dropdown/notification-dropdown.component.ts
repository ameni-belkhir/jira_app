import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { SignalRService, AppNotification } from '../../../../services/signalr.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-notification-dropdown',
  templateUrl: './notification-dropdown.component.html',
  imports: [CommonModule, RouterModule],
  preserveWhitespaces: false,
})
export class NotificationDropdownComponent implements OnInit, OnDestroy {
  isOpen = false;
  notifications: AppNotification[] = [];
  unreadCount = 0;

  private signalRService = inject(SignalRService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  private subscription: Subscription = new Subscription();

  ngOnInit(): void {
    // Subscribe to the notifications list
    this.subscription.add(
      this.signalRService.notifications$.subscribe((notifications) => {
        this.notifications = notifications;
        this.unreadCount = notifications.filter((n) => !n.isRead).length;
      })
    );

    // Subscribe to the toast stream for real-time popups
    this.subscription.add(
      this.signalRService.toast$.subscribe((notification) => {
        this.showToast(notification);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
    // Opening the dropdown marks all as read
    if (this.isOpen && this.unreadCount > 0) {
      this.signalRService.markAllAsRead();
    }
  }

  closeDropdown(): void {
    this.isOpen = false;
  }

  onNotificationClick(notification: AppNotification): void {
    // Mark as read
    this.signalRService.markAsRead(notification.id);
    this.closeDropdown();

    // Navigate to the target URL if provided
    if (notification.targetUrl) {
      this.router.navigateByUrl(notification.targetUrl);
    }
  }

  onViewAll(): void {
    this.closeDropdown();
    // TODO: adjust to the real notifications page if it exists
    this.router.navigateByUrl('/statistics');
  }

  trackById(_index: number, notification: AppNotification): string | number {
    return notification.id;
  }

  /** Compute a relative "time ago" string. */
  timeAgo(date?: string): string {
    if (!date) return '';
    const then = new Date(date).getTime();
    const now = Date.now();
    const diffSeconds = Math.max(0, Math.floor((now - then) / 1000));

    if (diffSeconds < 60) return 'à l\'instant';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} j`;
  }

  /** Get a color/label for the notification type badge. */
  typeClass(type?: string): string {
    switch (type) {
      case 'success': return 'bg-success-500';
      case 'warning': return 'bg-orange-500';
      case 'error': return 'bg-error-500';
      default: return 'bg-brand-500';
    }
  }

  private showToast(notification: AppNotification): void {
    const prefix = notification.type === 'error'
      ? '❌ '
      : notification.type === 'success'
        ? '✅ '
        : notification.type === 'warning'
          ? '⚠️ '
          : '🔔 ';

    const message = notification.message
      ? `${notification.title} — ${notification.message}`
      : notification.title;

    this.notificationService.validation(`${prefix}${message}`, 6000);
  }
}

