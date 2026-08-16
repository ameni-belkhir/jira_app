import { Component, Output, EventEmitter, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, switchMap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { UserService, UserProfile } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { getRoleKeyLabel } from '../../utils/role.utils';
import { NotificationService } from '../../services/notification.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-edit-profile-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Fixed full-screen overlay (blocking) -->
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 dark:bg-black/70" (click)="cancel()">
      <div
        class="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-theme-xl border border-gray-200 dark:border-gray-800 p-6 max-h-[90vh] overflow-y-auto"
        (click)="$event.stopPropagation()"
      >
        <!-- Title -->
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-gray-800 dark:text-white">Modifier mon profil</h2>
          <button
            (click)="cancel()"
            class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
            title="Fermer"
          >
            <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <!-- Error message -->
        @if (errorMessage) {
          <div class="mb-4 p-3 rounded-lg bg-error-50 border border-error-200 text-xs text-error-700 dark:bg-error-500/10 dark:border-error-500/20 dark:text-error-400">
            {{ errorMessage }}
          </div>
        }

        <!-- Avatar -->
        <div class="flex items-center gap-5 mb-6">
          <div class="relative group shrink-0">
            <div class="w-20 h-20 rounded-full overflow-hidden border-4 border-gray-100 dark:border-gray-800 bg-gray-100 dark:bg-gray-800">
              @if (imagePreview) {
                <img [src]="imagePreview" alt="Profile preview" class="w-full h-full object-cover" />
              } @else {
                <div class="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                  <svg class="w-8 h-8" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                  </svg>
                </div>
              }
            </div>
            <label
              for="edit-profile-image-input"
              class="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 hover:bg-black/40 transition-all cursor-pointer"
              title="Changer la photo de profil"
            >
              <svg class="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </label>
            <input
              id="edit-profile-image-input"
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              title="Choisir une photo"
              (change)="onImageSelected($event)"
              class="hidden"
            />
          </div>
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-800 dark:text-white">{{ prenom || 'Votre' }} {{ nom || 'Nom' }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ email }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Accepté : JPG, JPEG, PNG, WEBP. Max 5 Mo.</p>
            @if (imageError) {
              <p class="mt-1 text-xs text-error-500">{{ imageError }}</p>
            }
          </div>
        </div>

        <!-- First Name -->
        <div class="mb-4">
          <label class="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Prénom
          </label>
          <input
            type="text"
            [(ngModel)]="prenom"
            placeholder="Votre prénom"
            class="block w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:text-white/90 dark:placeholder:text-white/30"
          />
        </div>

        <!-- Last Name -->
        <div class="mb-4">
          <label class="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Nom
          </label>
          <input
            type="text"
            [(ngModel)]="nom"
            placeholder="Votre nom"
            class="block w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:text-white/90 dark:placeholder:text-white/30"
          />
        </div>

        <!-- Email (readonly) -->
        <div class="mb-6">
          <label class="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Email
          </label>
          <input
            type="email"
            [value]="email"
            readonly
            class="block w-full rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed"
          />
        </div>

        <!-- Rôle global (lecture seule : seul un administrateur peut modifier le rôle) -->
        <div class="mb-6">
          <label class="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            Rôle
          </label>
          <div
            class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            role="status"
          >
            {{ roleLabel || '—' }}
          </div>
          <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Votre rôle est attribué par un administrateur et ne peut pas être modifié ici.
          </p>
        </div>

        <!-- Footer buttons -->
        <div class="flex items-center justify-end gap-3">
          <button
            (click)="cancel()"
            [disabled]="saving()"
            class="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Annuler
          </button>
          <button
            (click)="onSave()"
            [disabled]="saving()"
            class="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            @if (saving()) {
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Enregistrement…
            } @else {
              Enregistrer
            }
          </button>
        </div>
      </div>
    </div>
  `,
  styles: ``,
})
export class EditProfileModalComponent implements OnInit {
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private userService = inject(UserService);
  private authService = inject(AuthService);
  private notification = inject(NotificationService);

  nom = '';
  prenom = '';
  email = '';
  roleLabel = '';
  userId: string | null = null;

  selectedImage: File | null = null;
  imagePreview: string | null = null;
  imageError = '';

  saving = signal(false);
  errorMessage = '';

  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  private readonly ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  ngOnInit(): void {
    this.userId = this.authService.getUserId();
    this.email = this.authService.getEmail() || '';
    this.roleLabel = getRoleKeyLabel(this.authService.getRole());
    this.loadUser();
  }

  private loadUser(): void {
    if (!this.userId) return;
    this.userService.getUser(this.userId).subscribe({
      next: (user: UserProfile) => {
        this.nom = user.nom || '';
        this.prenom = user.prenom || '';
        this.email = user.email || this.email;
        if (user.profileImageUrl) {
          this.imagePreview = this.getProfileImageUrl(user.profileImageUrl);
        }
      },
      error: () => {
        this.errorMessage = 'Impossible de charger le profil.';
      }
    });
  }

  private getProfileImageUrl(path: string): string {
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const baseUrl = environment.apiUrl.replace('/api', '');
    return path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.imageError = '';

    if (!input.files || input.files.length === 0) return;

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

  onSave(): void {
    this.errorMessage = '';

    if (!this.nom.trim() || !this.prenom.trim()) {
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires.';
      this.notification.validation('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (!this.userId) {
      this.errorMessage = 'Utilisateur non authentifié.';
      this.notification.error('Utilisateur non authentifié.');
      return;
    }

    this.saving.set(true);
    this.notification.loading('Enregistrement du profil…');

    const payload = {
      nom: this.nom.trim(),
      prenom: this.prenom.trim()
    };
    console.log('Payload envoyé (PUT /Users/:id):', payload);

    const request$ = this.selectedImage
      ? this.userService.uploadProfilePicture(this.selectedImage).pipe(
          switchMap((response) => {
            this.imagePreview = this.getProfileImageUrl(response.profileImageUrl);
            localStorage.setItem('userAvatar', this.imagePreview);
            localStorage.setItem('userIdProfile', this.userId!);
            window.dispatchEvent(new Event('storage'));
            return this.userService.updateUser(this.userId!, payload);
          })
        )
      : this.userService.updateUser(this.userId, payload);

    request$
      .pipe(finalize(() => {
        this.saving.set(false);
        this.notification.dismiss();
      }))
      .subscribe({
        next: (updatedUser: UserProfile | null) => {
          // Le backend PUT /Users/{id} renvoie 204 No Content → updatedUser peut être null.
          // On se rabat alors sur les valeurs saisies dans le formulaire.
          const updatedPrenom = updatedUser?.prenom ?? this.prenom.trim();
          const updatedNom = updatedUser?.nom ?? this.nom.trim();
          const updatedEmail = updatedUser?.email ?? this.email;

          const fullName = `${updatedPrenom || ''} ${updatedNom || ''}`.trim();
          if (fullName) localStorage.setItem('userName', fullName);
          if (updatedEmail) localStorage.setItem('userEmail', updatedEmail);
          const avatarUrl = updatedUser?.profileImageUrl
            ? this.getProfileImageUrl(updatedUser.profileImageUrl)
            : this.imagePreview;
          if (avatarUrl) localStorage.setItem('userAvatar', avatarUrl);
          localStorage.setItem('userIdProfile', this.userId!);
          window.dispatchEvent(new Event('storage'));

          this.notification.success('Profil mis à jour avec succès.');
          this.saved.emit();
          this.closed.emit();
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 0
            ? 'Impossible de se connecter au serveur.'
            : err.status === 400
              ? (typeof err.error === 'string' && err.error.trim() !== ''
                  ? err.error
                  : 'Données invalides. Vérifiez vos champs.')
              : err.status === 401 || err.status === 403
                ? 'Session expirée. Veuillez vous reconnecter.'
                : err.status === 404
                  ? 'Utilisateur introuvable.'
                  : err.status === 500
                    ? 'Serveur indisponible.'
                    : 'Échec de la mise à jour du profil.';
          this.errorMessage = msg;
          this.notification.error(msg);
        }
      });
  }

  cancel(): void {
    this.closed.emit();
  }
}

