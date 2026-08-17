import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../shared/services/theme.service';
import { ThemeToggleButtonComponent } from '../../shared/components/common/theme-toggle/theme-toggle-button.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ThemeToggleButtonComponent],
  templateUrl: './landing-page.component.html',
  styles: ``,
})
export class LandingPageComponent {
  private router = inject(Router);
  private authService = inject(AuthService);

  /** Source de vérité globale clair/sombre (partagée avec Dashboard, Sidebar, etc.). */
  themeService = inject(ThemeService);

  email = '';
  year = new Date().getFullYear();

  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated;
  }

  get logoTarget(): string {
    return this.isAuthenticated ? '/dashboard' : '/';
  }

  get signupTarget(): string {
    return this.isAuthenticated ? '/dashboard' : '/register';
  }

  onEmailSignup(): void {
    const email = this.email.trim();
    const queryParams = email ? { queryParams: { email } } : {};
    this.router.navigate([this.signupTarget], queryParams);
  }
}
