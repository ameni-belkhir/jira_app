import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BacklogSprint, BacklogTicket } from './project.service';

@Injectable({
  providedIn: 'root'
})
export class SprintService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** GET /api/projects/{projectId}/sprints — sprints d'un projet avec leurs tickets. */
  getSprints(projectId: number): Observable<BacklogSprint[]> {
    return this.http.get<BacklogSprint[]>(`${this.apiUrl}/projects/${projectId}/sprints`);
  }

  /** GET /api/sprints/{sprintId}/tickets — tickets du sprint (données fraîches). */
  getTickets(sprintId: number): Observable<BacklogTicket[]> {
    return this.http.get<BacklogTicket[]>(`${this.apiUrl}/sprints/${sprintId}/tickets`);
  }
}
