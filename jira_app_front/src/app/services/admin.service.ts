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

  updateUserRole(userId: number, roleId: number): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/admin/users/${userId}/role`, { roleId });
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

