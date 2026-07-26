import { Component, inject } from '@angular/core';
import { AuthPageLayoutComponent } from '../../shared/layout/auth-page-layout/auth-page-layout.component';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService, RegisterRequest } from '../../services/auth.service';
import { NotificationService } from '../../shared/services/notification.service';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    AuthPageLayoutComponent,
    RouterModule,
    ReactiveFormsModule,
    CommonModule
  ],
  templateUrl: './signup.component.html',
  styles: ``
})
export class SignupComponent {
  signupForm: FormGroup;
  submitted = false;
  error = '';
  loading = false;

  private notification = inject(NotificationService);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.signupForm = this.fb.group({
      prenom: ['', [Validators.required, Validators.minLength(2)]],
      nom: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });

    // Redirect to dashboard if already authenticated
    if (this.authService.isAuthenticated) {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    }
  }

  passwordMatchValidator(g: FormGroup) {
    const password = g.get('password')?.value;
    const confirm = g.get('confirmPassword')?.value;
    return password === confirm ? null : { mismatch: true };
  }

  get f() {
    return this.signupForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    this.error = '';

    if (this.signupForm.invalid) {
      this.notification.validation('Veuillez remplir tous les champs correctement.');
      return;
    }

    this.loading = true;
    this.notification.loading('Création du compte…');

    const registerData: RegisterRequest = {
      nom: this.signupForm.value.nom,
      prenom: this.signupForm.value.prenom,
      email: this.signupForm.value.email,
      password: this.signupForm.value.password,
      roleId: 1
    };

    this.authService.register(registerData)
      .pipe(finalize(() => {
        this.loading = false;
        this.notification.dismiss();
      }))
      .subscribe({
        next: () => {
          this.notification.success('Compte créé avec succès ! Vérifiez votre email.');
          this.router.navigate(['/verify-email'], { queryParams: { email: this.signupForm.value.email } });
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 400
            ? 'Requête invalide. Vérifiez vos informations.'
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

