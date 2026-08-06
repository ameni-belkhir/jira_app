import { Injectable, Injector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { SignalRService } from './signalr.service';
import { normalizeRole } from '../shared/config/navigation.config';

export interface LoginRequest {
  email: string;
  password: string;
}

export type LoginResponse = LoginSuccessResponse | LoginTwoFactorResponse;

export interface LoginSuccessResponse {
  token: string;
  email: string;
  role: string;
  expiration: string;
  mustChangePassword?: boolean;
  /** Permissions réelles de l'utilisateur renvoyées par le backend au login. */
  permissions?: string[];
}

export interface LoginTwoFactorResponse {
  requiresTwoFactor: true;
  email: string;
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
  private readonly PERMISSIONS_KEY = 'permissions';
  private readonly MUST_CHANGE_PASSWORD_KEY = 'mustChangePassword';

  private apiUrl = environment.apiUrl;
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.checkAuth());
  private permissionsSubject = new BehaviorSubject<string[]>(this.getPermissions());

  get isAuthenticated$(): Observable<boolean> {
    return this.isAuthenticatedSubject.asObservable();
  }

  get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  /** Observable des permissions (interface keys) de l'utilisateur connecté. */
  get permissions$(): Observable<string[]> {
    return this.permissionsSubject.asObservable();
  }

  /** Valeur courante des permissions. */
  get permissions(): string[] {
    return this.permissionsSubject.value;
  }

  constructor(private http: HttpClient, private injector: Injector) {}

  /** Lazily start the SignalR connection after a successful login or page refresh. */
  private startSignalR(): void {
    try {
      const signalR = this.injector.get(SignalRService);
      signalR.startConnection();
    } catch {
      // SignalRService may not be available yet; silently ignore.
    }
  }

  /** Lazily stop the SignalR connection on logout. */
  private stopSignalR(): void {
    try {
      const signalR = this.injector.get(SignalRService);
      signalR.stopConnection();
    } catch {
      // silently ignore
    }
  }

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
    return this.http.post<LoginResponse>(`${this.apiUrl}/Auth/login`, credentials);
  }

  register(data: RegisterRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/Auth/register`, data);
  }

  verifyCode(data: VerifyCodeRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/Auth/verify-code`, data);
  }

  verifyLoginCode(data: VerifyCodeRequest): Observable<LoginSuccessResponse> {
    return this.http.post<LoginSuccessResponse>(`${this.apiUrl}/Auth/verify-login-code`, data);
  }

  verifyRegistrationCode(data: VerifyCodeRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/Auth/verify-code`, data);
  }

  forgotPassword(data: ForgotPasswordRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/Auth/forgot-password`, data);
  }

  resetPassword(data: ResetPasswordRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/Auth/reset-password`, data);
  }

  /**
   * Saves the authentication session from a successful login (or 2FA verification).
   * Stores token, email, role, expiration, userId, mustChangePassword in localStorage.
   * Les permissions viennent directement de la réponse du backend (`response.permissions`).
   */
  saveAuthSession(response: LoginSuccessResponse): void {
    localStorage.setItem(this.TOKEN_KEY, response.token);
    localStorage.setItem(this.EMAIL_KEY, response.email);
    localStorage.setItem(this.ROLE_KEY, response.role);
    localStorage.setItem(this.EXPIRATION_KEY, response.expiration);
    // Store mustChangePassword flag
    if (response.mustChangePassword !== undefined) {
      localStorage.setItem(this.MUST_CHANGE_PASSWORD_KEY, String(response.mustChangePassword));
    }
    const userId = this.getUserIdFromToken(response.token);
    if (userId) {
      localStorage.setItem(this.USER_ID_KEY, userId);
    }
    // Permissions réelles de l'utilisateur, renvoyées par le backend au login.
    this.savePermissions(response.permissions ?? []);
    this.isAuthenticatedSubject.next(true);
    // Start the SignalR notifications connection once authenticated.
    this.startSignalR();
  }

  /**
   * Fetches user permissions from the backend.
   * Call this after login if permissions are not included in LoginSuccessResponse.
   */
  loadPermissions(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/Auth/me/permissions`);
  }

  /**
   * Rafraîchit les permissions de l'utilisateur connecté depuis le backend
   * (GET /api/Auth/me/permissions) et met à jour le stockage local + l'observable.
   * Utile si l'admin vient de modifier les permissions pendant la session.
   */
  refreshPermissions(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/Auth/me/permissions`).pipe(
      tap((perms) => this.savePermissions(perms ?? []))
    );
  }

  /**
   * Rafraîchit SILENCIEUSEMENT les permissions depuis le backend (GET /Auth/me/permissions)
   * et écrase `localStorage['permissions']` + l'observable avec le résultat frais.
   *
   * Conçu pour être appelé en arrière-plan :
   * - juste après un login réussi (pour rester robuste si `AuthResponseDto.Permissions`
   *   n'est pas à jour) ;
   * - au démarrage de l'application quand un token valide existe déjà (F5 / retour
   *   sans re-login).
   *
   * En cas d'échec (ex : token expiré), on ne fait RIEN : le mécanisme existant
   * d'expiration / redirection vers /login prend le relais. Aucun état de chargement
   * bloquant n'est affiché.
   */
  refreshPermissionsSilently(): void {
    if (!this.isAuthenticated) return;
    this.refreshPermissions().subscribe({
      next: (perms) => this.savePermissions(perms ?? []),
      error: () => {
        // Silencieux : le flux d'authentification existant gère l'expiration/redirection.
      },
    });
  }

/**
   * Persist permissions array to localStorage and notify subscribers.
   */
  savePermissions(permissions: string[]): void {
    localStorage.setItem(this.PERMISSIONS_KEY, JSON.stringify(permissions));
    this.permissionsSubject.next(permissions);
  }

  /**
   * Returns the list of interface keys the user has access to.
   */
  getPermissions(): string[] {
    try {
      const raw = localStorage.getItem(this.PERMISSIONS_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }

  /**
   * Checks if the user has a specific permission by interface key.
   */
  hasPermission(key: string): boolean {
    return this.permissionsSubject.value.includes(key);
  }

  logout(): void {
    this.clearStorage();
    this.isAuthenticatedSubject.next(false);
    this.permissionsSubject.next([]);
    // Stop the SignalR connection on logout.
    this.stopSignalR();
  }

private clearStorage(): void {
    // Préserve la configuration frontend des pages par rôle (global, par rôle).
    // Seules les informations de session doivent être supprimées au logout.
    const rolePermissions = localStorage.getItem('rolePagePermissions');
    localStorage.clear();
    if (rolePermissions !== null) {
      localStorage.setItem('rolePagePermissions', rolePermissions);
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /** Rôle normalisé (Admin, ScrumMaster, Senior, Developer) ou null. */
  getRole(): string | null {
    const raw = localStorage.getItem(this.ROLE_KEY);
    if (!raw) return null;
    return normalizeRole(raw);
  }

  getRoleKey(): 'Admin' | 'ScrumMaster' | 'Senior' | 'Developer' | '' {
    const r = this.getRole();
    if (r === 'Admin' || r === 'ScrumMaster' || r === 'Senior' || r === 'Developer') return r;
    return '';
  }

  isAdmin(): boolean {
    return this.getRole() === 'Admin';
  }

  getEmail(): string | null {
    return localStorage.getItem(this.EMAIL_KEY);
  }

  getUserId(): string | null {
    return localStorage.getItem(this.USER_ID_KEY);
  }

  /**
   * Returns whether the user must change their password on next login.
   * Returns false if the key is absent (backward compatibility).
   */
  getMustChangePassword(): boolean {
    const val = localStorage.getItem(this.MUST_CHANGE_PASSWORD_KEY);
    if (val === null) return false;
    return val === 'true';
  }

  /**
   * Clears the mustChangePassword flag after a successful password change.
   */
  clearMustChangePassword(): void {
    localStorage.setItem(this.MUST_CHANGE_PASSWORD_KEY, 'false');
  }

  /**
   * Changes the user's password by calling the backend endpoint.
   */
  changePassword(newPassword: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/Auth/change-password`, { newPassword });
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
