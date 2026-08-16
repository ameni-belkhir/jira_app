import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserProfile {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  /** URL de l'image de profil, renvoyée par le backend sous la clé "profileImageUrl" */
  profileImageUrl?: string;
  role?: string;
}

export interface UpdateUserRequest {
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
    formData.append('file', file, file.name);

    // Debug: log FormData keys and values
    console.log('[UploadProfilePicture] FormData entries:');
    formData.forEach((value, key) => {
      if (value instanceof File) {
        console.log(`  ${key}: File(name=${value.name}, size=${value.size}, type=${value.type})`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    });

    return this.http.post<UploadProfileImageResponse>(`${this.apiUrl}/Users/upload-profile-picture`, formData);
  }
}

