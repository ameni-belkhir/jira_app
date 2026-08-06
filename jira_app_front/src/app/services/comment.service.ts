import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** A comment on a ticket. */
export interface TicketComment {
  id: number | string;
  ticketId: number;
  message: string;
  auteur?: string;
  auteurPhoto?: string;
  role?: string;
  dateCreation?: string;
}

export interface CreateCommentRequest {
  ticketId: number;
  message: string;
  auteur?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** GET /api/Commentaires — retrieve all comments for a ticket. */
  getComments(ticketId: number): Observable<TicketComment[]> {
    return this.http.get<TicketComment[]>(`${this.apiUrl}/Commentaires`, {
      params: { ticketId: ticketId.toString() },
    });
  }

  /** POST /api/Commentaires — create a new comment. */
  addComment(data: CreateCommentRequest): Observable<TicketComment> {
    return this.http.post<TicketComment>(`${this.apiUrl}/Commentaires`, data);
  }

  /** DELETE /api/Commentaires/{id} — remove a comment. */
  deleteComment(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/Commentaires/${id}`);
  }
}

