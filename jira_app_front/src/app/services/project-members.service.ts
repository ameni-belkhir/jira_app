import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AvailableUser {
  id: number;
  nom: string;
  prenom: string;
  email: string;
}

/** Membre d'un projet tel que retourné par GET /projects/{projectId}/members (avec email + rôle). */
export interface ProjectMemberWithEmail {
  userId: number;
  nom: string;
  prenom: string;
  email: string;
  roleInProject: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectMembersService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** GET tous les membres d'un projet (userId, nom, prenom, email, roleInProject). */
  getProjectMembers(projectId: number): Observable<ProjectMemberWithEmail[]> {
    return this.http.get<ProjectMemberWithEmail[]>(`${this.apiUrl}/projects/${projectId}/members`);
  }

  /** GET available seniors not yet assigned to a project */
  getAvailableSeniors(projectId: number): Observable<AvailableUser[]> {
    return this.http.get<AvailableUser[]>(`${this.apiUrl}/projects/${projectId}/available-seniors`);
  }

  /** GET available developers not yet assigned to a project */
  getAvailableDevelopers(projectId: number): Observable<AvailableUser[]> {
    return this.http.get<AvailableUser[]>(`${this.apiUrl}/projects/${projectId}/available-developers`);
  }

  /** POST assign a senior to a project */
  addSeniorToProject(projectId: number, userId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/projects/${projectId}/members/senior`, { userId });
  }

  /** POST assign a developer to a project */
  addDeveloperToProject(projectId: number, userId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/projects/${projectId}/members/developer`, { userId });
  }
}

