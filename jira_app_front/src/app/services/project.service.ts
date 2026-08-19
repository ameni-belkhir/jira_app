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
  dueDate?: string | null;
  sprintId?: number | null;
  color?: string;
  hasSubTickets?: boolean;
  parentTicketId?: number | null;
  subTickets?: BacklogTicket[];
  isExpanded?: boolean;
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
  backlogTickets: BacklogTicket[];
  sprints: BacklogSprint[];
}

export interface SprintRequest {
  projectId: number;
  name: string;
  goal: string;
  startDate?: string;
  endDate?: string;
  assignedUserIds?: number[];
}

export interface SprintUpdateRequest {
  id?: number;
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

export interface CreateTicketRequest {
  titre: string;
  description: string | null;
  priority: string;          // Backend expects: 'BAS' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE'
  projectId: number;
  creatorId: number;
  sprintId?: number | null;
  parentTicketId?: number | null;
  color?: string;
  /** ID unique du Developer assigné (champ réellement utilisé par le backend : CreateTicketDto.AssigneeId) */
  assigneeId?: number | null;
}

export interface ProjectMemberSummary {
  userId: number;
  nom: string;
  prenom: string;
  roleInProject: string;
}

/** Utilisateur sélectionnable dans app-user-role-selector (nom + prénom + email). */
export interface SelectableUser {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  roleInProject?: string;
  role?: string;
}

export interface BackendProject {
  id: number;
  nom: string;
  description?: string;
  responsable?: string;
  members: ProjectMemberSummary[];
}

export interface CreateProjectRequest {
  nom: string;
  description: string;
  responsable: string;
  scrumMasterIds: number[];
}

export interface UpdateProjectRequest {
  id: number;
  nom: string;
  description: string;
  responsable: string;
  scrumMasterIds: number[];
}

export interface AvailableScrumMaster {
  id: number;
  nom: string;
  prenom: string;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getProjects(): Observable<BackendProject[]> {
    return this.http.get<BackendProject[]>(`${this.apiUrl}/Projects`);
  }

  getProject(id: number): Observable<BackendProject> {
    return this.http.get<BackendProject>(`${this.apiUrl}/Projects/${id}`);
  }

  createProject(data: CreateProjectRequest): Observable<BackendProject> {
    return this.http.post<BackendProject>(`${this.apiUrl}/Projects`, data);
  }

  updateProject(id: number, data: UpdateProjectRequest): Observable<BackendProject> {
    return this.http.put<BackendProject>(`${this.apiUrl}/Projects/${id}`, data);
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

  createTicket(data: CreateTicketRequest): Observable<BacklogTicket> {
    return this.http.post<BacklogTicket>(`${this.apiUrl}/Tickets`, data);
  }

  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/Projects/${id}`);
  }

  getMyRole(projectId: number): Observable<{ roleInProject: string | null }> {
    return this.http.get<{ roleInProject: string | null }>(`${this.apiUrl}/projects/${projectId}/my-role`);
  }

  /** GET all users with the global role "ScrumMaster" (for multi-select in create project modal) */
  getAvailableScrumMasters(): Observable<AvailableScrumMaster[]> {
    return this.http.get<AvailableScrumMaster[]>(`${this.apiUrl}/projects/available-scrum-masters`);
  }

  /** GET tous les membres d'un projet (avec email + rôle) — endpoint backend réel GET /projects/{id}/members */
  getProjectMembersWithEmail(projectId: number): Observable<SelectableUser[]> {
    return this.http.get<SelectableUser[]>(`${this.apiUrl}/projects/${projectId}/members`);
  }
}
