import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

  updateStatus(ticketId: number, status: string): Observable<void> {
    console.log('[TicketService] PATCH /tickets/${ticketId}/status → body:', { status });
    return this.http.patch<void>(`${this.apiUrl}/tickets/${ticketId}/status`, { status });
  }
}

