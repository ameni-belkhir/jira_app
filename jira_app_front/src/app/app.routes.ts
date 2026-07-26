import { Routes } from '@angular/router';
import { AppLayoutComponent } from './shared/layout/app-layout/app-layout.component';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { RegisterComponent } from './pages/register/register.component';
import { VerifyEmailComponent } from './pages/verify-email/verify-email.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ProjectsComponent } from './pages/projects/projects.component';
import { ChatComponent } from './pages/chat/chat.component';
import { StatisticsComponent } from './pages/statistics/statistics.component';
import { ProductBacklogComponent } from './pages/product-backlog/product-backlog.component';
import { SprintKanbanViewComponent } from './pages/product-backlog/sprint-kanban-view/sprint-kanban-view.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
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
        // TODO: RÉACTIVER — Ajouter canActivate: [RoleGuard], data: { roles: ['Developer', 'Senior', 'ScrumMaster'] }
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
      },
      {
        path: 'statistics',
        component: StatisticsComponent,
        title: 'Analytics | Jira App',
      },
      {
        path: 'profile',
        component: ProfileComponent,
        title: 'Edit Profile | Jira App',
      },
      {
        path: 'backlog',
        redirectTo: '/projects/1/backlog',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/dashboard',
  },
];

