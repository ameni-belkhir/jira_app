import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig, MatSnackBarRef } from '@angular/material/snack-bar';

export type NotificationType = 'success' | 'error' | 'loading' | 'validation';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private snackBar = inject(MatSnackBar);

  /** Default duration in ms */
  private readonly DURATION = 4000;
  private readonly LONG_DURATION = 8000;

  private currentRef: MatSnackBarRef<any> | null = null;

  /**
   * Show a success notification (green).
   */
  success(message: string, duration: number = this.DURATION): void {
    this.dismiss();
    this.currentRef = this.snackBar.open(message, '✕', {
      duration,
      panelClass: ['notification-success'],
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }

  /**
   * Show an error notification (red).
   */
  error(message: string, duration: number = this.LONG_DURATION): void {
    this.dismiss();
    this.currentRef = this.snackBar.open(message, '✕', {
      duration,
      panelClass: ['notification-error'],
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }

  /**
   * Show a loading notification (blue/gray) — typically not auto-dismissed.
   * Call `dismiss()` when done.
   */
  loading(message: string = 'Chargement en cours…'): void {
    this.dismiss();
    this.currentRef = this.snackBar.open('⏳ ' + message, undefined, {
      duration: undefined, // stays until dismissed
      panelClass: ['notification-loading'],
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }

  /**
   * Show a validation/info notification (amber/yellow).
   */
  validation(message: string, duration: number = this.DURATION): void {
    this.dismiss();
    this.currentRef = this.snackBar.open(message, '✕', {
      duration,
      panelClass: ['notification-validation'],
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }

  /**
   * Dismiss the currently visible notification (if any).
   * Useful to remove a loading spinner after the operation completes.
   */
  dismiss(): void {
    if (this.currentRef) {
      this.currentRef.dismiss();
      this.currentRef = null;
    }
  }
}

