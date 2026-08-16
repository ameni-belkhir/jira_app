import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface SprintTicket {
  id: number;
  title: string;
  description?: string;
  priority: string;
  status: string;
  assignedTo?: string;
  assignedToAvatar?: string;
  color?: string;
  hasSubTickets?: boolean;
  parentTicketId?: number | null;
  subTickets?: SprintTicket[];
  isExpanded?: boolean;
}

export interface SubTicket {
  id: number;
  title: string;
  status: string;
  priority: string;
  assignedTo?: string;
  color?: string;
  hasSubTickets?: boolean;
  parentTicketId?: number | null;
}

export interface CreateSubTicketRequest {
  titre: string;
  description?: string | null;
  priority?: string;
  assigneeId?: number | null;
  color?: string;
}

/** Payload de mise à jour complète d'un ticket (PUT /api/Tickets/{id}). */
export interface UpdateTicketRequest {
  id: number;
  titre: string;
  description?: string | null;
  creatorId: number;
  assigneeId?: number | null;
  projectId?: number | null;
  sprintId?: number | null;
  status?: string;
  priority?: string;
  color?: string;
}

/** Détail complet d'un ticket (GET /api/Tickets/{id}) avec les champs d'édition. */
export interface TicketDetail extends SprintTicket {
  creatorId: number;
  assigneeId?: number | null;
  projectId?: number | null;
  sprintId?: number | null;
  dateCreation?: string;
  dateResolution?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class TicketService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getTicketsBySprint(sprintId: number): Observable<SprintTicket[]> {
    return this.http.get<SprintTicket[]>(`${this.apiUrl}/sprints/${sprintId}/tickets`);
  }

  deleteTicket(ticketId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tickets/${ticketId}`);
  }

  /** GET /api/Tickets/{id} — détail complet (creator, assignee, sprint, couleur, hiérarchie). */
  getTicket(ticketId: number): Observable<TicketDetail> {
    return this.http.get<any>(`${this.apiUrl}/Tickets/${ticketId}`).pipe(
      map((raw) => ({
        id: raw.id,
        title: raw.title ?? raw.titre ?? '',
        description: raw.description,
        priority: raw.priority,
        status: raw.status,
        color: raw.color ?? '#3b82f6',
        hasSubTickets: raw.hasSubTickets,
        parentTicketId: raw.parentTicketId ?? null,
        subTickets: (raw.subTickets || []).map((s: any) => ({
          id: s.id,
          title: s.title ?? s.titre ?? '',
          description: s.description,
          priority: s.priority,
          status: s.status,
          color: s.color,
          hasSubTickets: s.hasSubTickets,
          parentTicketId: s.parentTicketId ?? null,
        })),
        creatorId: raw.creatorId,
        assigneeId: raw.assigneeId ?? null,
        projectId: raw.projectId ?? null,
        sprintId: raw.sprintId ?? null,
        dateCreation: raw.dateCreation,
        dateResolution: raw.dateResolution,
      }))
    );
  }

  /** PUT /api/Tickets/{id} — mise à jour complète d'un ticket (titre, description, priority, assignee...). */
  updateTicket(ticketId: number, data: UpdateTicketRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/Tickets/${ticketId}`, data);
  }

  /** PUT /api/tickets/{ticketId}/move-to-sprint — déplace un ticket vers un sprint (ou null → backlog). */
  updateTicketSprint(ticketId: number, sprintId: number | null): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/tickets/${ticketId}/move-to-sprint`, { ticketId, sprintId });
  }

  updateStatus(ticketId: number, status: string): Observable<void> {
    console.log('[TicketService] PATCH /tickets/${ticketId}/status → body:', { status });
    return this.http.patch<void>(`${this.apiUrl}/tickets/${ticketId}/status`, { status });
  }

  /** PATCH /api/tickets/{id}/assignee — assigne ou désassigne un ticket (Admin, SM, Senior). */
  updateTicketAssignee(ticketId: number, assigneeId: number | null): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/tickets/${ticketId}/assignee`, { assigneeId });
  }

  getSubtickets(ticketId: number): Observable<SubTicket[]> {
    return this.http.get<any[]>(`${this.apiUrl}/tickets/${ticketId}/subtickets`).pipe(
      map(items => (items || []).map(item => ({
        id: item.id,
        title: item.title ?? item.titre ?? '',
        status: item.status,
        priority: item.priority,
        assignedTo: item.assignedTo ?? (item.assignee ? `${item.assignee.prenom} ${item.assignee.nom}` : undefined),
        color: item.color,
        hasSubTickets: item.hasSubTickets,
        parentTicketId: item.parentTicketId
      })))
    );
  }

  createSubTicket(parentId: number, dto: CreateSubTicketRequest): Observable<SubTicket> {
    return this.http.post<SubTicket>(`${this.apiUrl}/tickets/${parentId}/subtickets`, dto);
  }
}
