import { Component } from '@angular/core';
import { AuthPageLayoutComponent } from '../../shared/layout/auth-page-layout/auth-page-layout.component';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
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
      return;
    }

    this.loading = true;

    this.authService.forgotPassword({
      email: this.forgotForm.value.email
    })
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: () => {
          this.router.navigate(['/reset-password'], { queryParams: { email: this.forgotForm.value.email } });
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 400) {
            this.error = 'Invalid email address.';
          } else if (err.status === 404) {
            this.error = 'No account found with this email address.';
          } else if (err.status === 500) {
            this.error = 'Server unavailable. Please try again later.';
          } else if (err.status === 0) {
            this.error = 'Cannot connect to server. Please check your connection.';
          } else {
            this.error = 'An unexpected error occurred. Please try again.';
          }
        }
      });
  }
}

