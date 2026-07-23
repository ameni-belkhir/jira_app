import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserProfile {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  profileImage?: string;
  role?: string;
}

export interface UpdateUserRequest {
  id: string;
  nom: string;
  prenom: string;
}

export interface UploadProfileImageResponse {
  profileImageUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getUser(id: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/Users/${id}`);
  }

  updateUser(id: string, data: UpdateUserRequest): Observable<UserProfile> {
    return this.http.put<UserProfile>(`${this.apiUrl}/Users/${id}`, data);
  }

  uploadProfilePicture(file: File): Observable<UploadProfileImageResponse> {
    const formData = new FormData();
    formData.append('image', file, file.name);
    return this.http.post<UploadProfileImageResponse>(`${this.apiUrl}/Users/upload-profile-picture`, formData);
  }
}

