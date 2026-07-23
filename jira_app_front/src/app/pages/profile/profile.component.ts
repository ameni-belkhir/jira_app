import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { UserService, UserProfile, UpdateUserRequest } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styles: ``
})
export class ProfileComponent implements OnInit {
  // Form fields - ONLY nom, prenom (no email, no password, no role)
  nom = '';
  prenom = '';
  submitted = false;

  // User data
  user = signal<UserProfile | null>(null);

  // UI states
  loading = signal(false);
  saving = signal(false);
  uploadingImage = signal(false);
  error = signal('');
  success = signal('');

  // Image upload
  selectedImage: File | null = null;
  imagePreview: string | null = null;
  imageError = '';
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  private readonly ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    const userId = this.authService.getUserId();
    if (!userId) {
      this.error.set('User not authenticated.');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.success.set('');

    this.userService.getUser(userId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (user) => {
          this.user.set(user);
          this.nom = user.nom || '';
          this.prenom = user.prenom || '';
          if (user.profileImage) {
            this.imagePreview = this.getProfileImageUrl(user.profileImage);
          }
        },
        error: (err: HttpErrorResponse) => this.handleLoadError(err)
      });
  }

  private getProfileImageUrl(path: string): string {
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    // If it's a relative path, prepend the API base URL
    const baseUrl = 'https://localhost:7207';
    return path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
  }

  private handleLoadError(err: HttpErrorResponse): void {
    if (err.status === 0) {
      this.error.set('Cannot connect to server. Please check your connection.');
    } else if (err.status === 401 || err.status === 403) {
      this.error.set('Session expired. Please log in again.');
      this.router.navigate(['/login']);
    } else if (err.status === 404) {
      this.error.set('User profile not found.');
    } else if (err.status === 500) {
      this.error.set('Server unavailable. Please try again later.');
    } else {
      this.error.set('Failed to load profile. Please try again.');
    }
  }

  // ===== Image Upload =====
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.imageError = '';

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    // Validate type
    if (!this.ACCEPTED_TYPES.includes(file.type)) {
      this.imageError = 'Invalid format. Accepted: JPG, JPEG, PNG, WEBP.';
      return;
    }

    // Validate size
    if (file.size > this.MAX_FILE_SIZE) {
      this.imageError = 'File too large. Maximum size is 5 MB.';
      return;
    }

    // Store file for later upload
    this.selectedImage = file;

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreview = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeImage(): void {
    this.selectedImage = null;
    this.imagePreview = null;
    this.imageError = '';
  }

  // ===== Save =====
  onSave(): void {
    this.submitted = true;
    this.error.set('');
    this.success.set('');

    if (!this.nom.trim() || !this.prenom.trim()) {
      return;
    }

    const userId = this.authService.getUserId();
    if (!userId) {
      this.error.set('User not authenticated.');
      return;
    }

    this.saving.set(true);

    // Step 1: Upload image if selected
    const imageUpload$ = this.selectedImage
      ? this.userService.uploadProfilePicture(this.selectedImage).pipe(
          switchMap((response) => {
            this.imagePreview = this.getProfileImageUrl(response.profileImageUrl);
            // Update header/dropdown avatar via localStorage event
            localStorage.setItem('userAvatar', this.imagePreview);
            window.dispatchEvent(new Event('storage'));
            return this.userService.updateUser(userId, {
              id: userId,
              nom: this.nom.trim(),
              prenom: this.prenom.trim()
            });
          })
        )
      : this.userService.updateUser(userId, {
          id: userId,
          nom: this.nom.trim(),
          prenom: this.prenom.trim()
        });

    imageUpload$
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updatedUser) => {
          this.user.set(updatedUser);
          this.success.set('Profile updated successfully!');
          this.submitted = false;
          this.selectedImage = null;

          // Update localStorage for header/dropdown to reflect changes
          const fullName = `${updatedUser.prenom || ''} ${updatedUser.nom || ''}`.trim();
          if (fullName) localStorage.setItem('userName', fullName);
          localStorage.setItem('userAvatar', this.getProfileImageUrl(updatedUser.profileImage || ''));
          window.dispatchEvent(new Event('storage'));
        },
        error: (err: HttpErrorResponse) => this.handleSaveError(err)
      });
  }

  private handleSaveError(err: HttpErrorResponse): void {
    if (err.status === 0) {
      this.error.set('Cannot connect to server. Please check your connection.');
    } else if (err.status === 400) {
      this.error.set('Invalid data. Please check your inputs.');
    } else if (err.status === 401 || err.status === 403) {
      this.error.set('Session expired. Please log in again.');
      this.router.navigate(['/login']);
    } else if (err.status === 404) {
      this.error.set('User not found.');
    } else if (err.status === 500) {
      this.error.set('Server unavailable. Please try again later.');
    } else {
      this.error.set('Failed to update profile. Please try again.');
    }
  }
}

