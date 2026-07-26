import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { UserService, UserProfile, UpdateUserRequest } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../shared/services/notification.service';
import { environment } from '../../../environments/environment';

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

  private notification = inject(NotificationService);

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
      this.notification.error('Utilisateur non authentifié.');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.success.set('');
    this.notification.loading('Chargement du profil…');

    this.userService.getUser(userId)
      .pipe(finalize(() => {
        this.loading.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: (user) => {
          this.user.set(user);
          this.nom = user.nom || '';
          this.prenom = user.prenom || '';
          if (user.profileImage) {
            this.imagePreview = this.getProfileImageUrl(user.profileImage);
          }
          this.notification.success('Profil chargé avec succès.');
        },
        error: (err: HttpErrorResponse) => this.handleLoadError(err)
      });
  }

  private getProfileImageUrl(path: string): string {
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    // Extract backend base (no /api suffix) from apiUrl
    const baseUrl = environment.apiUrl.replace('/api', '');
    return path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
  }

  private handleLoadError(err: HttpErrorResponse): void {
    const msg = err.status === 0
      ? 'Impossible de se connecter au serveur.'
      : err.status === 401 || err.status === 403
        ? 'Session expirée. Veuillez vous reconnecter.'
        : err.status === 404
          ? 'Profil utilisateur introuvable.'
          : err.status === 500
            ? 'Serveur indisponible.'
            : 'Échec du chargement du profil.';
    this.error.set(msg);
    this.notification.error(msg);
    if (err.status === 401 || err.status === 403) {
      this.router.navigate(['/login']);
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

    if (!this.ACCEPTED_TYPES.includes(file.type)) {
      this.imageError = 'Format invalide. Accepté : JPG, JPEG, PNG, WEBP.';
      this.notification.validation('Format de fichier invalide.');
      return;
    }

    if (file.size > this.MAX_FILE_SIZE) {
      this.imageError = 'Fichier trop volumineux. Maximum 5 Mo.';
      this.notification.validation('Fichier trop volumineux. Maximum 5 Mo.');
      return;
    }

    this.selectedImage = file;

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
      this.notification.validation('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    const userId = this.authService.getUserId();
    if (!userId) {
      this.error.set('User not authenticated.');
      this.notification.error('Utilisateur non authentifié.');
      return;
    }

    this.saving.set(true);
    this.notification.loading('Enregistrement du profil…');

    const imageUpload$ = this.selectedImage
      ? this.userService.uploadProfilePicture(this.selectedImage).pipe(
          switchMap((response) => {
            this.imagePreview = this.getProfileImageUrl(response.profileImageUrl);
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
      .pipe(finalize(() => {
        this.saving.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: (updatedUser) => {
          this.user.set(updatedUser);
          this.success.set('Profile updated successfully!');
          this.submitted = false;
          this.selectedImage = null;

          const fullName = `${updatedUser.prenom || ''} ${updatedUser.nom || ''}`.trim();
          if (fullName) localStorage.setItem('userName', fullName);
          localStorage.setItem('userAvatar', this.getProfileImageUrl(updatedUser.profileImage || ''));
          window.dispatchEvent(new Event('storage'));

          this.notification.success('Profil mis à jour avec succès.');
        },
        error: (err: HttpErrorResponse) => this.handleSaveError(err)
      });
  }

  private handleSaveError(err: HttpErrorResponse): void {
    const msg = err.status === 0
      ? 'Impossible de se connecter au serveur.'
      : err.status === 400
        ? 'Données invalides. Vérifiez vos champs.'
        : err.status === 401 || err.status === 403
          ? 'Session expirée. Veuillez vous reconnecter.'
          : err.status === 404
            ? 'Utilisateur introuvable.'
            : err.status === 500
              ? 'Serveur indisponible.'
              : 'Échec de la mise à jour du profil.';
    this.error.set(msg);
    this.notification.error(msg);
    if (err.status === 401 || err.status === 403) {
      this.router.navigate(['/login']);
    }
  }
}

