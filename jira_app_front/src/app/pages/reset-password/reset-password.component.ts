import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { AuthPageLayoutComponent } from '../../shared/layout/auth-page-layout/auth-page-layout.component';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../shared/services/notification.service';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    AuthPageLayoutComponent,
    RouterModule,
    ReactiveFormsModule,
    CommonModule
  ],
  templateUrl: './reset-password.component.html',
  styles: ``
})
export class ResetPasswordComponent implements OnInit {
  resetForm: FormGroup;
  submitted = false;
  error = '';
  loading = false;
  email = '';

  private notification = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.resetForm = this.fb.group({
      email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
      token: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.email = params['email'] || '';
        if (this.email) {
          this.resetForm.patchValue({ email: this.email });
        }
      });
  }

  passwordMatchValidator(g: FormGroup) {
    const password = g.get('newPassword')?.value;
    const confirm = g.get('confirmPassword')?.value;
    return password === confirm ? null : { mismatch: true };
  }

  get f() {
    return this.resetForm.controls;
  }

  get formErrors() {
    return this.resetForm.errors;
  }

  onSubmit(): void {
    this.submitted = true;
    this.error = '';

    if (this.resetForm.invalid) {
      this.notification.validation('Veuillez remplir tous les champs correctement.');
      return;
    }

    this.loading = true;
    this.notification.loading('Réinitialisation du mot de passe…');

    this.authService.resetPassword({
      email: this.email,
      token: this.resetForm.value.token,
      newPassword: this.resetForm.value.newPassword
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loading = false;
          this.notification.dismiss();
        })
      )
      .subscribe({
        next: () => {
          this.notification.success('Mot de passe réinitialisé avec succès ! Vous pouvez vous connecter.');
          this.router.navigate(['/login']);
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 400
            ? 'Token de réinitialisation invalide ou expiré.'
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

