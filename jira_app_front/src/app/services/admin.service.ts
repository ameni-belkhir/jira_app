import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminUser {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  roleId: number;
  role: string;
  dateInscription: string;
  isEmailVerified: boolean;
  /** URL de la photo de profil, si le backend la renvoie */
  profileImageUrl?: string;
  /** Indique si le compte est actif, si le backend renvoie la propriété */
  isActive?: boolean;
}

export interface UserPermission {
  interfaceKey: string;
  isEnabled: boolean;
  label: string;
}

export interface AdminStats {
  totalUsers: number;
  totalUsersByRole: Record<string, number>;
  totalProjects: number;
  totalSprints: number;
  totalTickets: number;
  totalTicketsByStatus: Record<string, number>;
}

export interface Role {
  id: number;
  description: string;
}

/** Response from POST /admin/users — extends AdminUser with optional emailSent */
export interface CreateUserResponse extends AdminUser {
  emailSent?: boolean;
}

/** Projet où le RoleInProject d'un user diffère du nouveau rôle global proposé */
export interface RoleChangeImpactItem {
  projectId: number;
  projectName: string;
  currentRoleInProject: string;
}

/** Décision de l'admin pour un projet : aligner ou non le RoleInProject sur le nouveau rôle global */
export interface ProjectRoleDecision {
  projectId: number;
  alignToNewRole: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${this.apiUrl}/admin/users`);
  }

  getUserPermissions(userId: number): Observable<UserPermission[]> {
    return this.http.get<UserPermission[]>(`${this.apiUrl}/admin/users/${userId}/permissions`);
  }

  /** Projets où le RoleInProject de l'utilisateur diffère du rôle global proposé */
  getRoleChangeImpact(userId: number, roleId: number): Observable<RoleChangeImpactItem[]> {
    return this.http.get<RoleChangeImpactItem[]>(`${this.apiUrl}/admin/users/${userId}/role-change-impact`, {
      params: { roleId },
    });
  }

  updateUserRole(userId: number, roleId: number, decisions?: ProjectRoleDecision[]): Observable<any> {
    const body: Record<string, unknown> = { roleId };
    if (decisions && decisions.length > 0) {
      body['projectRoleDecisions'] = decisions;
    }
    return this.http.put<any>(`${this.apiUrl}/admin/users/${userId}/role`, body);
  }

  updateUserPermissions(userId: number, permissions: UserPermission[]): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/admin/users/${userId}/permissions`, { permissions });
  }

  createUser(data: { nom: string; prenom: string; email: string; password: string; roleId: number }): Observable<CreateUserResponse> {
    return this.http.post<CreateUserResponse>(`${this.apiUrl}/admin/users`, data);
  }

  getProjects(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/admin/projects`);
  }

  getStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.apiUrl}/admin/stats`);
  }

  deleteUser(userId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/admin/users/${userId}`);
  }
}

