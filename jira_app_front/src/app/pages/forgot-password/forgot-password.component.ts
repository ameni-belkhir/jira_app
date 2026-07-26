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
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    AuthPageLayoutComponent,
    RouterModule,
    ReactiveFormsModule,
    CommonModule
  ],
  templateUrl: './forgot-password.component.html',
  styles: ``
})
export class ForgotPasswordComponent {
  forgotForm: FormGroup;
  submitted = false;
  error = '';
  success = '';
  loading = false;

  private notification = inject(NotificationService);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  get f() {
    return this.forgotForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    this.error = '';
    this.success = '';

    if (this.forgotForm.invalid) {
      this.notification.validation('Veuillez entrer votre email.');
      return;
    }

    this.loading = true;
    this.notification.loading('Envoi de l\'email de réinitialisation…');

    this.authService.forgotPassword({ email: this.forgotForm.value.email })
      .pipe(finalize(() => {
        this.loading = false;
        this.notification.dismiss();
      }))
      .subscribe({
        next: () => {
          this.notification.success('Email de réinitialisation envoyé. Vérifiez votre boîte de réception.');
          this.router.navigate(['/reset-password'], { queryParams: { email: this.forgotForm.value.email } });
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 400
            ? 'Adresse email invalide.'
            : err.status === 404
              ? 'Aucun compte trouvé avec cet email.'
              : err.status === 500
                ? 'Serveur indisponible.'
                : err.status === 0
                  ? 'Impossible de se connecter au serveur.'
                  : 'Une erreur inattendue est survenue.';
          this.error = msg;
          this.notification.error(msg);
        }
      });
  }
}

