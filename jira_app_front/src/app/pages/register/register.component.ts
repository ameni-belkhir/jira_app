import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService, RegisterRequest } from '../../services/auth.service';
import { NotificationService } from '../../shared/services/notification.service';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthPageLayoutComponent } from '../../shared/layout/auth-page-layout/auth-page-layout.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    AuthPageLayoutComponent,
    RouterModule,
    ReactiveFormsModule,
    CommonModule
  ],
  templateUrl: './register.component.html',
  styles: ``
})
export class RegisterComponent implements OnInit {
  step: 'register' | 'verifyCode' = 'register';
  registerForm: FormGroup;
  verifyForm: FormGroup;
  submitted = false;
  error = '';
  loading = false;
  registeredEmail = '';

  // URL params from invitation
  token: string | null = null;
  invitationEmail: string | null = null;
  invitationRole: string | null = null;
  projectId: number | null = null;

  private notification = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.registerForm = this.fb.group({
      prenom: ['', [Validators.required, Validators.minLength(2)]],
      nom: ['', [Validators.required, Validators.minLength(2)]],
      email: [{ value: '', disabled: false }, [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });

    this.verifyForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]]
    });
  }

  ngOnInit(): void {
    // Redirect to dashboard if already authenticated
    if (this.authService.isAuthenticated) {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
      return;
    }

    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
      this.token = params['token'] || null;
      this.invitationEmail = params['email'] || null;
      // TODO: RÉACTIVER — Décommenter quand le système d'invitation sera implémenté
      // this.invitationRole = params['role'] || null;
      this.projectId = params['projectId'] ? Number(params['projectId']) : null;

      if (this.invitationEmail) {
        this.registerForm.patchValue({ email: this.invitationEmail });
      }
    });
  }

  passwordMatchValidator(g: FormGroup) {
    const password = g.get('password')?.value;
    const confirm = g.get('confirmPassword')?.value;
    return password === confirm ? null : { mismatch: true };
  }

  get f() {
    return this.registerForm.controls;
  }

  get vf() {
    return this.verifyForm.controls;
  }

  onSubmit(): void {
    this.submitted = true;
    this.error = '';

    if (this.registerForm.invalid) {
      this.notification.validation('Veuillez remplir tous les champs correctement.');
      return;
    }

    this.loading = true;
    this.notification.loading('Inscription en cours…');

    // Map invitation role to roleId
    let roleId = 1;
    if (this.invitationRole === 'Senior') {
      roleId = 2;
    } else if (this.invitationRole === 'Developer') {
      roleId = 3;
    }

    const registerData: RegisterRequest = {
      nom: this.registerForm.value.nom,
      prenom: this.registerForm.value.prenom,
      email: this.registerForm.value.email,
      password: this.registerForm.value.password,
      roleId: roleId
    };

    this.authService.register(registerData)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loading = false;
          this.notification.dismiss();
        })
      )
      .subscribe({
        next: () => {
          this.registeredEmail = this.registerForm.value.email;
          this.step = 'verifyCode';
          this.notification.success('Un code de vérification vous a été envoyé par email.');
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

  onVerifyCode(): void {
    this.submitted = true;
    this.error = '';

    if (this.verifyForm.invalid) {
      this.notification.validation('Veuillez entrer le code à 4 chiffres.');
      return;
    }

    this.loading = true;
    this.notification.loading('Vérification du code…');

    this.authService.verifyRegistrationCode({
      email: this.registeredEmail,
      code: this.verifyForm.value.code
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
          this.notification.success('E-mail vérifié avec succès.');
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

  resendCode(): void {
    this.loading = true;
    this.notification.loading('Renvoi du code…');

    const registerData: RegisterRequest = {
      nom: this.registerForm.value.nom,
      prenom: this.registerForm.value.prenom,
      email: this.registeredEmail,
      password: this.registerForm.value.password,
      roleId: 1
    };

    this.authService.register(registerData)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loading = false;
          this.notification.dismiss();
        })
      )
      .subscribe({
        next: () => {
          this.error = '';
          this.verifyForm.reset();
          this.submitted = false;
          this.notification.success('Un nouveau code vous a été envoyé par email.');
        },
        error: () => {
          this.notification.error('Impossible de renvoyer le code. Veuillez réessayer.');
        }
      });
  }

  goBackToForm(): void {
    this.step = 'register';
    this.error = '';
    this.submitted = false;
    this.verifyForm.reset();
  }
}

