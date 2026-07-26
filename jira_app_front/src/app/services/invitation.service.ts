import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SendInvitationRequest {
  email: string;
  role: string;
  projectId: number;
}

@Injectable({
  providedIn: 'root'
})
export class InvitationService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  sendInvitation(data: SendInvitationRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/Invitations/send`, data);
  }
}

