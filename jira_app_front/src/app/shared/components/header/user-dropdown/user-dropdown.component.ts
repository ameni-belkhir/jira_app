import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../services/auth.service';
import { UserService } from '../../../../services/user.service';
import { SafeImagePipe } from '../../../pipe/safe-image.pipe';
import { EditProfileModalComponent } from '../../edit-profile-modal/edit-profile-modal.component';
import { environment } from '../../../../../environments/environment';

/**
 * Inline SVG data URI for a generic anonymous user avatar.
 * Used as ultimate fallback when the image URL is missing or returns 404.
 */
const DEFAULT_AVATAR_DATA_URI = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='50' fill='%23e2e8f0'/%3E%3Ctext x='50' y='58' text-anchor='middle' font-size='38' fill='%2394a3b8' font-family='Arial'%3E👤%3C/text%3E%3C/svg%3E`;

@Component({
  selector: 'app-user-dropdown',
  templateUrl: './user-dropdown.component.html',
  imports:[CommonModule, RouterModule, SafeImagePipe, EditProfileModalComponent]
})
export class UserDropdownComponent implements OnInit, OnDestroy {
  isOpen = false;
  isEditProfileOpen = false;
  userName = 'User';
  userEmail = '';
  userAvatar = DEFAULT_AVATAR_DATA_URI;
  fetchingProfile = signal(false);
  private storedUserId: string | null = null;
  private storageListener: (() => void) | null = null;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.userEmail = this.authService.getEmail() || '';
    this.loadUserFromStorage();
    this.ensureProfileLoaded();

    // Listen for storage events to update avatar/name when profile is saved
    this.storageListener = () => {
      this.loadUserFromStorage();
    };
    window.addEventListener('storage', this.storageListener);
  }

  ngOnDestroy(): void {
    if (this.storageListener) {
      window.removeEventListener('storage', this.storageListener);
    }
  }

  private loadUserFromStorage(): void {
    const storedName = localStorage.getItem('userName');
    if (storedName) {
      this.userName = storedName;
    }
    const storedAvatar = localStorage.getItem('userAvatar');
    if (storedAvatar && storedAvatar.trim() !== '') {
      this.userAvatar = storedAvatar;
    } else {
      this.userAvatar = DEFAULT_AVATAR_DATA_URI;
    }
    this.storedUserId = localStorage.getItem('userIdProfile');
  }

  /**
   * La topbar ne dépend que du localStorage, qui n'est peuplé qu'après une
   * première sauvegarde manuelle de profil (le login ne fournit ni nom ni
   * prénom). Fallback : si le nom ou l'avatar font défaut, on charge
   * GET /Users/{id} une seule fois et on persiste en localStorage, comme le
   * fait la modale de profil. AuthService/JWT restent intacts.
   */
  private ensureProfileLoaded(): void {
    const userId = this.authService.getUserId();
    const belongsToCurrentUser =
      !userId || !this.storedUserId || this.storedUserId === userId;
    const hasRealName = this.userName.trim() !== '' && this.userName !== 'User';
    const hasRealAvatar = this.userAvatar !== DEFAULT_AVATAR_DATA_URI;

    // Profil stocké appartenant à un AUTRE compte : rechargement forcé,
    // même si le nom semble "valide" (fuite entre comptes).
    if (!belongsToCurrentUser) {
      this.loadProfileFromApi(userId);
      return;
    }
    if (hasRealName && hasRealAvatar) return;
    if (!userId) return;

    this.loadProfileFromApi(userId);
  }

  private loadProfileFromApi(userId: string): void {
    this.fetchingProfile.set(true);
    this.userService
      .getUser(userId)
      .pipe(finalize(() => this.fetchingProfile.set(false)))
      .subscribe({
        next: (user) => {
          const fullName = `${user.prenom || ''} ${user.nom || ''}`.trim();
          if (fullName) {
            this.userName = fullName;
            localStorage.setItem('userName', fullName);
          }
          if (user.profileImageUrl) {
            const avatarUrl = this.getProfileImageUrl(user.profileImageUrl);
            this.userAvatar = avatarUrl;
            localStorage.setItem('userAvatar', avatarUrl);
          }
          if (user.email) {
            this.userEmail = user.email;
            localStorage.setItem('userEmail', user.email);
          }
          localStorage.setItem('userIdProfile', userId);
          window.dispatchEvent(new Event('storage'));
        },
        error: () => {
          // Silencieux : on garde les valeurs actuelles (placeholders).
        },
      });
  }

  /** Construit l'URL absolue de l'avatar comme dans la modale de profil. */
  private getProfileImageUrl(path: string): string {
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const baseUrl = environment.apiUrl.replace('/api', '');
    return path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
  }

  /**
   * Handles image load errors (404, network failure, etc.)
   * Replaces the broken URL with the default inline SVG avatar.
   */
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && img.src !== DEFAULT_AVATAR_DATA_URI) {
      img.src = DEFAULT_AVATAR_DATA_URI;
      img.srcset = '';   // Prevent srcset from re-triggering the error
    }
  }

  toggleDropdown() {
    this.isOpen = !this.isOpen;
  }

  closeDropdown() {
    this.isOpen = false;
  }

  /**
   * Opens the edit-profile modal and closes the dropdown menu.
   * Keeps the user on the current page (no URL change / no navigation).
   */
  openEditProfileModal(): void {
    this.closeDropdown();
    this.isEditProfileOpen = true;
  }

  closeEditProfileModal(): void {
    this.isEditProfileOpen = false;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}
