import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ProjectService } from '../services/project.service';
import { map, Observable, of } from 'rxjs';

export const RoleGuard: CanActivateFn = (route): boolean | UrlTree | Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const projectService = inject(ProjectService);
  const router = inject(Router);

  const role = authService.getRole();

  if (!authService.isAuthenticated) {
    return router.parseUrl('/login');
  }

  const projectIdParam = route.paramMap.get('id');
  const projectId = projectIdParam ? Number(projectIdParam) : null;

  const allowedRoles = route.data?.['roles'] as string[] | undefined;

  // Admin can access everything
  if (role === 'Admin') {
    return true;
  }

  // ScrumMaster can access everything
  if (role === 'ScrumMaster') {
    return true;
  }

  // Senior access: if projectId, check membership
  if (role === 'Senior') {
    if (!projectId) {
      return true;
    }
    return isMemberOfProject(projectId, authService, projectService, router);
  }

  // Developer access: requires projectId + membership
  if (role === 'Developer') {
    if (!projectId) {
      return router.parseUrl('/dashboard');
    }
    return isMemberOfProject(projectId, authService, projectService, router);
  }

  // Fallback: check allowedRoles from route data
  if (allowedRoles && allowedRoles.length > 0) {
    if (role && allowedRoles.includes(role)) {
      return true;
    }
    return router.parseUrl('/dashboard');
  }

  // No roles restriction defined → allow
  return true;
};

function isMemberOfProject(
  projectId: number,
  authService: AuthService,
  projectService: ProjectService,
  router: Router
): Observable<boolean | UrlTree> {
  const userId = authService.getUserId();

  if (!userId) {
    return of(router.parseUrl('/login'));
  }

  return projectService.getProject(projectId).pipe(
    map(project => {
      if (!project || !project.members) {
        return router.parseUrl('/dashboard');
      }
      const isMember = project.members.some(m => m.userId === Number(userId));
      if (isMember) {
        return true;
      }
      return router.parseUrl('/dashboard');
    })
  );
}
