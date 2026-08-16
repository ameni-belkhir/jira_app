import { Routes } from '@angular/router';
import { AppLayoutComponent } from './shared/layout/app-layout/app-layout.component';
import { LandingPageComponent } from './pages/landing/landing-page.component';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { RegisterComponent } from './pages/register/register.component';
import { VerifyEmailComponent } from './pages/verify-email/verify-email.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ProjectsComponent } from './pages/projects/projects.component';
import { ChatComponent } from './pages/chat/chat.component';
import { ProductBacklogComponent } from './pages/product-backlog/product-backlog.component';
import { SprintKanbanViewComponent } from './pages/product-backlog/sprint-kanban-view/sprint-kanban-view.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';
import { AdminGuard } from './guards/admin.guard';
import { PermissionGuard } from './guards/permission.guard';
import { AdminUsersComponent } from './pages/admin/admin-users.component';
import { AdminProjectsComponent } from './pages/admin/admin-projects.component';
import { AdminStatisticsComponent } from './pages/admin/admin-statistics.component';

export const routes: Routes = [
  {
    path: '',
    component: LandingPageComponent,
    pathMatch: 'full',
    title: 'Jira App | Gestion de projets',
  },
  {
    path: 'landing',
    component: LandingPageComponent,
    title: 'Jira App | Gestion de projets',
  },
  {
    path: 'signup',
    component: SignupComponent,
    title: 'Sign Up | Jira App',
  },
  {
    path: 'register',
    component: RegisterComponent,
    title: 'Register | Jira App',
  },
  {
    path: 'login',
    component: LoginComponent,
    title: 'Sign In | Jira App',
  },
  {
    path: 'verify-email',
    component: VerifyEmailComponent,
    title: 'Verify Email | Jira App',
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent,
    title: 'Forgot Password | Jira App',
  },
  {
    path: 'reset-password',
    component: ResetPasswordComponent,
    title: 'Reset Password | Jira App',
  },
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        component: DashboardComponent,
        title: 'Dashboard | Jira App',
        canActivate: [PermissionGuard],
        data: { pageKey: 'dashboard' },
      },
      {
        path: 'projects',
        component: ProjectsComponent,
        title: 'Projects | Jira App',
      },
      {
        path: 'projects/:id/backlog',
        component: ProductBacklogComponent,
        title: 'Product Backlog | Jira App',
        canActivate: [RoleGuard],
        data: { roles: ['Developer', 'Senior', 'ScrumMaster'] }
      },
      {
        path: 'projects/:projectId/sprint/:sprintId/kanban',
        component: SprintKanbanViewComponent,
title: 'Sprint Kanban | Jira App',
      },
      {
        path: 'projects/:id',
        redirectTo: (route) => {
          const id = route.params['id'];
          return `/projects/${id}/backlog`;
        },
        pathMatch: 'full',
      },
      {
        path: 'chat',
        component: ChatComponent,
        title: 'Messages | Jira App',
        canActivate: [PermissionGuard],
        data: { pageKey: 'chat' },
      },
      {
        path: 'messages',
        redirectTo: '/chat',
        pathMatch: 'full',
      },
      {
        path: 'kanban',
        redirectTo: '/projects',
        pathMatch: 'full',
      },
      {
        path: 'profile',
        component: ProfileComponent,
        title: 'Edit Profile | Jira App',
        canActivate: [PermissionGuard],
        data: { pageKey: 'profile' },
      },
      {
        path: 'admin',
        canActivate: [AdminGuard, PermissionGuard],
        data: { pageKey: 'admin-users' },
        children: [
          {
            path: 'users',
            component: AdminUsersComponent,
            title: 'Admin Users | Jira App',
          },
          {
            path: 'roles',
            redirectTo: '/admin/users',
            pathMatch: 'full',
          },
          {
            path: 'projects',
            component: AdminProjectsComponent,
            title: 'Admin Projects | Jira App',
          },
          {
            path: 'statistics',
            component: AdminStatisticsComponent,
            title: 'Admin Statistics | Jira App',
          },
        ],
      },
      {
        path: 'backlog',
        redirectTo: '/projects',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];

