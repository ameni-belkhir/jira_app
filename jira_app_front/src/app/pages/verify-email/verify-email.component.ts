import { Component, OnInit } from '@angular/core';
import { AuthPageLayoutComponent } from '../../shared/layout/auth-page-layout/auth-page-layout.component';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
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
      return;
    }

    this.loading = true;

    this.authService.verifyCode({
      email: this.email,
      code: this.verifyForm.value.code
    })
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: () => {
          this.router.navigate(['/login']);
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 400) {
            this.error = 'Invalid or expired verification code. Please try again.';
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

