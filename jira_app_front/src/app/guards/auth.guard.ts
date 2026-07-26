import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): boolean | UrlTree {
    // Primary check: use AuthService's isAuthenticated (backed by BehaviorSubject + localStorage check)
    if (this.authService.isAuthenticated) {
      return true;
    }

    // Safety net: directly verify token in localStorage
    // This covers edge cases where BehaviorSubject might be out of sync
    const token = this.authService.getToken();
    if (token) {
      return true;
    }

    // No valid token → redirect to /login with replaceUrl to prevent back navigation
    return this.router.parseUrl('/login');
  }
}

