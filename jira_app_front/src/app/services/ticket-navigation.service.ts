import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/** Résultat du parsing d'un TargetUrl de notification de deadline :
 *  "/projects/{projectId}/backlog?ticket={ticketId}". */
export interface BacklogTicketUrl {
  projectId: number;
  ticketId: number;
}

/**
 * Bus de navigation "ouvrir un ticket", partagé entre le dropdown de
 * notifications et la page ProductBacklog qui héberge ticket-detail-modal :
 * quand une notification est cliquée alors que l'utilisateur est déjà sur le
 * bon backlog, on ouvre le ticket sans recharger la page.
 */
@Injectable({ providedIn: 'root' })
export class TicketNavigationService {
  private readonly openTicketSubject = new Subject<number>();

  /** Émet l'ID du ticket à ouvrir sur la page backlog courante. */
  readonly openTicket$ = this.openTicketSubject.asObservable();

  requestOpenTicket(ticketId: number): void {
    this.openTicketSubject.next(ticketId);
  }

  /**
   * Extrait { projectId, ticketId } d'un TargetUrl de notification de deadline
   * ("/projects/{id}/backlog?ticket={tid}"), ou null si le format ne correspond pas.
   * Aucun champ TicketId dédié n'existe côté backend : l'URL est la source de vérité.
   */
  parseBacklogTicketUrl(url: string): BacklogTicketUrl | null {
    try {
      const queryIndex = url.indexOf('?');
      if (queryIndex === -1) return null;
      const pathMatch = /^\/projects\/(\d+)\/backlog$/.exec(url.slice(0, queryIndex));
      if (!pathMatch) return null;
      const ticketParam = new URLSearchParams(url.slice(queryIndex + 1)).get('ticket');
      if (!ticketParam || !/^\d+$/.test(ticketParam)) return null;
      return { projectId: Number(pathMatch[1]), ticketId: Number(ticketParam) };
    } catch {
      return null;
    }
  }
}
