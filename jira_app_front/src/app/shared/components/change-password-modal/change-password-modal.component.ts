import { Component, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-change-password-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Fixed full-screen overlay (blocking) -->
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 dark:bg-black/70">
      <div class="relative w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-theme-xl border border-gray-200 dark:border-gray-800 p-6">
        <!-- Title -->
        <div class="text-center mb-6">
          <div class="mx-auto w-12 h-12 rounded-full bg-warning-100 dark:bg-warning-500/10 flex items-center justify-center mb-3">
            <svg class="w-6 h-6 text-warning-600 dark:text-warning-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-800 dark:text-white">Changement de mot de passe requis</h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Vous devez changer votre mot de passe avant de continuer.
          </p>
        </div>

        <!-- Error message -->
        @if (errorMessage) {
          <div class="mb-4 p-3 rounded-lg bg-error-50 border border-error-200 text-xs text-error-700 dark:bg-error-500/10 dark:border-error-500/20 dark:text-error-400">
            {{ errorMessage }}
          </div>
        }

        <!-- New password -->
        <div class="mb-4">
          <label class="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Nouveau mot de passe
          </label>
          <input
            type="password"
            [(ngModel)]="newPassword"
            placeholder="Minimum 8 caractères"
            class="block w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:text-white/90 dark:placeholder-gray-500"
          />
        </div>

        <!-- Confirm password -->
        <div class="mb-6">
          <label class="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Confirmer le mot de passe
          </label>
          <input
            type="password"
            [(ngModel)]="confirmPassword"
            placeholder="Confirmer le mot de passe"
            class="block w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:text-white/90 dark:placeholder-gray-500"
          />
        </div>

        <!-- Submit button -->
        <button
          (click)="onSubmit()"
          [disabled]="submitting()"
          class="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          @if (submitting()) {
            <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Changement en cours…
          } @else {
            Changer le mot de passe
          }
        </button>
      </div>
  `,
  styles: ``,
})
export class ChangePasswordModalComponent {
  private authService = inject(AuthService);
  private notification = inject(NotificationService);

  @Output() passwordChanged = new EventEmitter<void>();

  newPassword = '';
  confirmPassword = '';
  submitting = signal(false);
  errorMessage = '';

  onSubmit(): void {
    this.errorMessage = '';

    // Validate minimum length
    if (!this.newPassword || this.newPassword.length < 8) {
      this.errorMessage = 'Le mot de passe doit contenir au moins 8 caractères.';
      return;
    }

    // Validate passwords match
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Les mots de passe ne correspondent pas.';
      return;
    }

    this.submitting.set(true);
    this.authService.changePassword(this.newPassword)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.authService.clearMustChangePassword();
          this.notification.success('Mot de passe modifié avec succès.');
          this.passwordChanged.emit();
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 0
            ? 'Impossible de se connecter au serveur.'
            : err.error?.message || err.error?.title || 'Échec du changement de mot de passe.';
          this.errorMessage = msg;
          this.notification.error(msg);
        }
      });
  }
}
