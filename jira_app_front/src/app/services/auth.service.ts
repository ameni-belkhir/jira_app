import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  email: string;
  role: string;
  expiration: string;
}

export interface RegisterRequest {
  nom: string;
  prenom: string;
  email: string;
  password: string;
  roleId: number;
}

export interface VerifyCodeRequest {
  email: string;
  code: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'token';
  private readonly EMAIL_KEY = 'email';
  private readonly ROLE_KEY = 'role';
  private readonly EXPIRATION_KEY = 'expiration';
  private readonly USER_ID_KEY = 'userId';

  private apiUrl = environment.apiUrl;
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.checkAuth());

  get isAuthenticated$(): Observable<boolean> {
    return this.isAuthenticatedSubject.asObservable();
  }

  get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  constructor(private http: HttpClient) {}

  private checkAuth(): boolean {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return false;

    const expiration = localStorage.getItem(this.EXPIRATION_KEY);
    if (expiration) {
      const expDate = new Date(expiration);
      if (expDate <= new Date()) {
        this.clearStorage();
        return false;
      }
    }

    return true;
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/Auth/login`, credentials).pipe(
      tap(response => this.handleLoginResponse(response))
    );
  }

  register(data: RegisterRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/Auth/register`, data);
  }

  verifyCode(data: VerifyCodeRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/Auth/verify-code`, data);
  }

  forgotPassword(data: ForgotPasswordRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/Auth/forgot-password`, data);
  }

  resetPassword(data: ResetPasswordRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/Auth/reset-password`, data);
  }

  private handleLoginResponse(response: LoginResponse): void {
    localStorage.setItem(this.TOKEN_KEY, response.token);
    localStorage.setItem(this.EMAIL_KEY, response.email);
    localStorage.setItem(this.ROLE_KEY, response.role);
    localStorage.setItem(this.EXPIRATION_KEY, response.expiration);
    // Extract userId from JWT and store it
    const userId = this.getUserIdFromToken(response.token);
    if (userId) {
      localStorage.setItem(this.USER_ID_KEY, userId);
    }
    this.isAuthenticatedSubject.next(true);
  }

  logout(): void {
    this.clearStorage();
    this.isAuthenticatedSubject.next(false);
  }

  private clearStorage(): void {
    localStorage.clear();
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRole(): string | null {
    return localStorage.getItem(this.ROLE_KEY);
  }

  getEmail(): string | null {
    return localStorage.getItem(this.EMAIL_KEY);
  }

  getUserId(): string | null {
    return localStorage.getItem(this.USER_ID_KEY);
  }

  /**
   * Decodes the JWT token payload to extract the NameIdentifier (user id) claim.
   * JWT format: header.payload.signature
   */
  getUserIdFromToken(token: string): string | null {
    try {
      const payloadBase64 = token.split('.')[1];
      const payloadJson = atob(payloadBase64);
      const payload = JSON.parse(payloadJson);
      // The claim name for user id can vary based on ASP.NET Core configuration
      const userId = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
        || payload['nameidentifier']
        || payload['sub']
        || payload['nameid'];
      return userId || null;
    } catch {
      return null;
    }
  }
}
