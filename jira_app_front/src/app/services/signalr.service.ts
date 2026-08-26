import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HubConnection, HubConnectionBuilder, HubConnectionState, HttpTransportType, LogLevel } from '@microsoft/signalr';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { TicketComment } from './comment.service';

/** Shape of a notification received from the SignalR hub (or REST fallback). */
export interface AppNotification {
  id: string | number;
  title: string;
  message?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  /** Relative or absolute route to navigate to when the notification is clicked. */
  targetUrl?: string;
  isRead?: boolean;
  createdAt?: string;
}

/** A comment received in real-time via SignalR. */
export interface TicketCommentEvent {
  comment: TicketComment;
}

@Injectable({ providedIn: 'root' })
export class SignalRService {
  private authService = inject(AuthService);
  private http = inject(HttpClient);

  /** Base URL de l'API REST (identique aux autres services). */
  private readonly apiUrl = environment.apiUrl;

  /** Base SignalR hub URL. */
  private get hubUrl(): string {
    const configuredUrl = environment.signalrHubUrl?.trim();
    return configuredUrl ? configuredUrl : `${environment.baseUrl.replace(/\/$/, '')}/hubs/notifications`;
  }

  private hubConnection: HubConnection | null = null;

  /** Holds the list of notifications (newest first). */
  private notificationsSubject = new BehaviorSubject<AppNotification[]>([]);

  /** Emits each newly received notification (used for toasts). */
  private toastSubject = new Subject<AppNotification>();

  /** Emits each ticket comment received via SignalR. */
  private ticketCommentSubject = new Subject<TicketComment>();

  /** Observable of the full notifications list. */
  readonly notifications$ = this.notificationsSubject.asObservable();

  /** Observable emitting each incoming notification (toast stream). */
  readonly toast$ = this.toastSubject.asObservable();

  /** Observable emitting each real-time ticket comment. */
  readonly ticketComment$ = this.ticketCommentSubject.asObservable();

  /** Current connection state. */
  get connectionState(): HubConnectionState {
    return this.hubConnection?.state ?? HubConnectionState.Disconnected;
  }

  /** Latest snapshot of notifications. */
  getNotifications(): AppNotification[] {
    return this.notificationsSubject.getValue();
  }

  /** Number of unread notifications. */
  getUnreadCount(): number {
    return this.notificationsSubject.getValue().filter((n) => !n.isRead).length;
  }

  /**
   * Establishes the WebSocket connection to the SignalR notifications hub,
   * passing the JWT token in the access token factory.
   */
  startConnection(): void {
    // Avoid duplicate connections
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      return;
    }

    // If a connection exists but is disconnected, clean it up before rebuilding.
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

    // Listen for incoming notifications
    this.hubConnection.on('ReceiveNotification', (notification: AppNotification) => {
      this.handleIncomingNotification(notification);
    });

    // Optional: listen for a notification list snapshot
    this.hubConnection.on('NotificationsLoaded', (notifications: AppNotification[]) => {
      if (Array.isArray(notifications)) {
        this.notificationsSubject.next(notifications);
      }
    });

    // Listen for real-time ticket comments broadcast on the ticket channel.
    // The backend may send either a single comment or a wrapper { comment }.
    this.hubConnection.on('ReceiveTicketComment', (payload: TicketComment | TicketCommentEvent) => {
      const comment = (payload as TicketCommentEvent).comment
        ? (payload as TicketCommentEvent).comment
        : (payload as TicketComment);
      if (comment) {
        this.ticketCommentSubject.next(comment);
      }
    });

    this.hubConnection
      .start()
      .then(() => {
        console.log('[SignalR] Connected to notifications hub.');
        // Peuple la liste initiale depuis le serveur (notifications reçues
        // hors session) avant que le push temps réel ne prenne le relais.
        this.loadInitialNotifications();
      })
      .catch((err) => {
        console.error('[SignalR] Connection failed: ', err);
      });
  }

  /**
   * GET /api/Notifications — charge les notifications persistées au démarrage
   * de la session (celles reçues hors session seraient sinon perdues au
   * refresh). Fusionne sans doublon avec d'éventuelles notifs déjà arrivées
   * via le push SignalR, triées de la plus récente à la plus ancienne.
   */
  private loadInitialNotifications(): void {
    if (!this.authService.getToken()) return;
    this.http.get<AppNotification[]>(`${this.apiUrl}/Notifications`).subscribe({
      next: (items) => {
        if (!Array.isArray(items)) return;
        const merged = new Map<string | number, AppNotification>();
        for (const n of this.notificationsSubject.getValue()) {
          merged.set(n.id ?? Date.now(), n);
        }
        for (const n of items) {
          merged.set(n.id ?? Date.now(), {
            id: n.id,
            title: n.title,
            message: n.message,
            type: n.type,
            targetUrl: n.targetUrl,
            isRead: n.isRead ?? false,
            createdAt: n.createdAt,
          });
        }
        const sorted = Array.from(merged.values())
          .sort(
            (a, b) =>
              new Date(b.createdAt ?? 0).getTime() -
              new Date(a.createdAt ?? 0).getTime()
          )
          .slice(0, 50);
        this.notificationsSubject.next(sorted);
      },
      error: () => {
        // Silencieux : le push temps réel prendra le relais.
      },
    });
  }

  /** Gracefully stops the hub connection. */
  stopConnection(): void {
    if (this.hubConnection && this.hubConnection.state !== HubConnectionState.Disconnected) {
      this.hubConnection
        .stop()
        .catch((err) => console.error('[SignalR] Error stopping connection: ', err));
    }
    this.hubConnection = null;
  }

  /** Marks a notification as read (local state immediately + persisted server-side). */
  markAsRead(id: string | number): void {
    const current = this.notificationsSubject.getValue();
    const updated = current.map((n) =>
      n.id === id ? { ...n, isRead: true } : n
    );
    this.notificationsSubject.next(updated);
    // Persistance côté serveur (best effort : échec silencieux,
    // l'état local reste à jour).
    this.http
      .put(`${this.apiUrl}/Notifications/${id}/read`, {})
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  /** Marks all notifications as read (local state immediately + persisted server-side). */
  markAllAsRead(): void {
    const current = this.notificationsSubject.getValue();
    this.notificationsSubject.next(
      current.map((n) => ({ ...n, isRead: true }))
    );
    // Persistance côté serveur (best effort : échec silencieux,
    // l'état local reste à jour).
    this.http
      .put(`${this.apiUrl}/Notifications/read-all`, {})
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  /**
   * Supprime côté serveur toutes les notifications déjà lues (best effort :
   * échec silencieux), puis les retire de la liste locale uniquement
   * en cas de succès.
   */
  clearReadNotifications(): void {
    this.http.delete(`${this.apiUrl}/Notifications/read`).subscribe({
      next: () => {
        this.notificationsSubject.next(
          this.notificationsSubject.getValue().filter((n) => !n.isRead)
        );
      },
      error: () => {
        // Silencieux : la liste locale reste inchangée.
      },
    });
  }

  /** Add a notification to the list (e.g. seeded/fallback). */
  addNotification(notification: AppNotification): void {
    this.handleIncomingNotification(notification);
  }

  /** Prepend an incoming notification and emit a toast event. */
  private handleIncomingNotification(notification: AppNotification): void {
    const normalized: AppNotification = {
      id: notification.id ?? Date.now(),
      title: notification.title ?? 'Notification',
      message: notification.message ?? '',
      type: notification.type ?? 'info',
      targetUrl: notification.targetUrl,
      isRead: notification.isRead ?? false,
      createdAt: notification.createdAt ?? new Date().toISOString(),
    };

    const current = this.notificationsSubject.getValue();
    // Avoid duplicates by id
    const exists = current.some((n) => n.id === normalized.id);
    if (!exists) {
      this.notificationsSubject.next([normalized, ...current].slice(0, 50));
    }

    // Emit to the toast stream
    this.toastSubject.next(normalized);
  }
}

