import { Routes } from '@angular/router';
import { AppLayoutComponent } from './shared/layout/app-layout/app-layout.component';
import { LoginComponent } from './pages/login/login.component';
import { SignupComponent } from './pages/signup/signup.component';
import { VerifyEmailComponent } from './pages/verify-email/verify-email.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { TicketsComponent } from './pages/tickets/tickets.component';
import { ChatComponent } from './pages/chat/chat.component';
import { StatisticsComponent } from './pages/statistics/statistics.component';
import { ChatbotComponent } from './pages/chatbot/chatbot.component';
import { UsersComponent } from './pages/users/users.component';
import { RolesComponent } from './pages/roles/roles.component';
import { ProductBacklogComponent } from './pages/product-backlog/product-backlog.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/signup',
    pathMatch: 'full',
  },
  {
    path: 'signup',
    component: SignupComponent,
    title: 'Sign Up | Jira App',
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
        path: 'tickets',
        component: TicketsComponent,
        title: 'Tickets | Jira App',
      },
      {
        path: 'chat',
        component: ChatComponent,
        title: 'Chat | Jira App',
      },
      {
        path: 'statistics',
        component: StatisticsComponent,
        title: 'Statistics | Jira App',
      },
      {
        path: 'chatbot',
        component: ChatbotComponent,
        title: 'Chatbot | Jira App',
      },
      {
        path: 'users',
        component: UsersComponent,
        title: 'Users | Jira App',
      },
      {
        path: 'roles',
        component: RolesComponent,
        title: 'Roles | Jira App',
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
      {
        path: 'projects/:id/backlog',
        component: ProductBacklogComponent,
        title: 'Product Backlog | Jira App',
      },
      {
        path: 'projects/:id',
        redirectTo: '/projects/:id/backlog',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '**',
    redirectTo: '/signup',
  },
];
