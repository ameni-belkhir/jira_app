import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BacklogTicket {
  id: number;
  title: string;
  description?: string;
  priority: string;
  status: string;
  assignedTo?: string;
  assignedToAvatar?: string;
  creationDate?: string;
  sprintId?: number | null;
}

export interface BacklogSprint {
  id: number;
  projectId: number;
  name: string;
  goal: string;
  status: string;
  startDate?: string;
  endDate?: string;
  tickets: BacklogTicket[];
}

export interface BacklogResponse {
  unassignedTickets: BacklogTicket[];
  sprints: BacklogSprint[];
}

export interface SprintRequest {
  projectId: number;
  name: string;
  goal: string;
  startDate?: string;
  endDate?: string;
}

export interface SprintUpdateRequest {
  name?: string;
  goal?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface MoveTicketRequest {
  ticketId: number;
  sprintId: number | null;
}

export interface BackendProject {
  id: number;
  name: string;
  description?: string;
  status?: string;
  ticketCount?: number;
  totalTickets?: number;
  dueDate?: string;
  teamMembers?: string[];
}

export interface CreateProjectRequest {
  name: string;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getProjects(): Observable<BackendProject[]> {
    return this.http.get<BackendProject[]>(`${this.apiUrl}/projects`);
  }

  createProject(data: CreateProjectRequest): Observable<BackendProject> {
    return this.http.post<BackendProject>(`${this.apiUrl}/Projects`, data);
  }

  getBacklog(projectId: number): Observable<BacklogResponse> {
    return this.http.get<BacklogResponse>(`${this.apiUrl}/projects/${projectId}/backlog`);
  }

  getSprints(projectId: number): Observable<BacklogSprint[]> {
    return this.http.get<BacklogSprint[]>(`${this.apiUrl}/projects/${projectId}/sprints`);
  }

  createSprint(data: SprintRequest): Observable<BacklogSprint> {
    return this.http.post<BacklogSprint>(`${this.apiUrl}/sprints`, data);
  }

  updateSprint(id: number, data: SprintUpdateRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/sprints/${id}`, data);
  }

  moveTicketToSprint(ticketId: number, data: MoveTicketRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/tickets/${ticketId}/move-to-sprint`, data);
  }
}

