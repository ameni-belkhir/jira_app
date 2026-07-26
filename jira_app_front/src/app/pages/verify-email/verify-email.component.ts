import { Component, OnInit, inject } from '@angular/core';
import { AuthPageLayoutComponent } from '../../shared/layout/auth-page-layout/auth-page-layout.component';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../shared/services/notification.service';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [
    AuthPageLayoutComponent,
    RouterModule,
    ReactiveFormsModule,
    CommonModule
  ],
  templateUrl: './verify-email.component.html',
  styles: ``
})
export class VerifyEmailComponent implements OnInit {
  verifyForm: FormGroup;
  submitted = false;
  error = '';
  loading = false;
  email = '';

  private notification = inject(NotificationService);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.verifyForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(4)]]
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.email = params['email'] || '';
      if (!this.email) {
        this.router.navigate(['/signup']);
      }
    });
  }

  get f() {
    return this.verifyForm.controls;
  }

  onVerify(): void {
    this.submitted = true;
    this.error = '';

    if (this.verifyForm.invalid) {
      this.notification.validation('Veuillez entrer le code de vérification.');
      return;
    }

    this.loading = true;
    this.notification.loading('Vérification du code…');

    this.authService.verifyCode({
      email: this.email,
      code: this.verifyForm.value.code
    })
      .pipe(finalize(() => {
        this.loading = false;
        this.notification.dismiss();
      }))
      .subscribe({
        next: () => {
          this.notification.success('Email vérifié avec succès ! Vous pouvez maintenant vous connecter.');
          this.router.navigate(['/login']);
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 400
            ? 'Code de vérification invalide ou expiré.'
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

