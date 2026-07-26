import { Component, inject } from '@angular/core';
import { AuthPageLayoutComponent } from '../../shared/layout/auth-page-layout/auth-page-layout.component';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../shared/services/notification.service';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    AuthPageLayoutComponent,
    RouterModule,
    ReactiveFormsModule,
    CommonModule
  ],
  templateUrl: './login.component.html',
  styles: ``
})
export class LoginComponent {
  loginForm: FormGroup;
  submitted = false;
  error = '';
  loading = false;

  private notification = inject(NotificationService);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });

    // Redirect to dashboard if already authenticated
    if (this.authService.isAuthenticated) {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    }
  }

  get f() {
    return this.loginForm.controls;
  }

  onLogin(): void {
    this.submitted = true;
    this.error = '';

    if (this.loginForm.invalid) {
      this.notification.validation('Veuillez remplir tous les champs.');
      return;
    }

    this.loading = true;
    this.notification.loading('Connexion en cours…');

    this.authService.login(this.loginForm.value)
      .pipe(finalize(() => {
        this.loading = false;
        this.notification.dismiss();
      }))
      .subscribe({
        next: () => {
          this.notification.success('Connexion réussie !');
          this.router.navigate(['/dashboard']);
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 401
            ? 'Email ou mot de passe invalide.'
            : err.status === 400
              ? 'Requête invalide.'
              : err.status === 500
                ? 'Serveur indisponible.'
                : err.status === 0
                  ? 'Impossible de se connecter au serveur.'
                  : 'Une erreur est survenue.';
          this.error = msg;
          this.notification.error(msg);
        }
      });
  }
}

