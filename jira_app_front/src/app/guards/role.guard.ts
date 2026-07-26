import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';

// TODO: RÉACTIVER QUAND LE SYSTÈME DE RÔLES SERA IMPLÉMENTÉ
// import { inject } from '@angular/core';
// import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
// import { AuthService } from '../services/auth.service';
// import { ProjectService } from '../services/project.service';
// import { map, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  // TODO: RÉACTIVER — Décommenter les injections et la logique ci-dessous
  // private authService = inject(AuthService);
  // private projectService = inject(ProjectService);
  // private router = inject(Router);

  canActivate(): boolean {
    // TODO: RÉACTIVER — Remplacer 'return true' par la logique de vérification des rôles
    // Actuellement désactivé : tous les utilisateurs authentifiés ont accès
    return true;
  }

  // TODO: RÉACTIVER — Décommenter toute la méthode ci-dessous
  /*
  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree | Observable<boolean | UrlTree> {
    const role = this.authService.getRole();

    if (!this.authService.isAuthenticated) {
      return this.router.parseUrl('/login');
    }

    const projectIdParam = route.paramMap.get('id');
    const projectId = projectIdParam ? Number(projectIdParam) : null;

    const allowedRoles = route.data?.['roles'] as string[] | undefined;

    if (role === 'ScrumMaster') {
      return true;
    }

    if (role === 'Senior') {
      if (!projectId) {
        return true;
      }
      return this.isMemberOfProject(projectId);
    }

    if (role === 'Developer') {
      if (!projectId) {
        return this.router.parseUrl('/dashboard');
      }
      return this.isMemberOfProject(projectId);
    }

    if (allowedRoles && allowedRoles.length > 0) {
      if (role && allowedRoles.includes(role)) {
        return true;
      }
      return this.router.parseUrl('/dashboard');
    }

    return true;
  }

  private isMemberOfProject(projectId: number): Observable<boolean | UrlTree> {
    const userId = this.authService.getUserId();

    if (!userId) {
      return of(this.router.parseUrl('/login'));
    }

    return this.projectService.getProject(projectId).pipe(
      map(project => {
        if (!project || !project.memberIds) {
          return this.router.parseUrl('/dashboard');
        }
        const isMember = project.memberIds.includes(Number(userId));
        if (isMember) {
          return true;
        }
        return this.router.parseUrl('/dashboard');
      })
    );
  }
  */
}

