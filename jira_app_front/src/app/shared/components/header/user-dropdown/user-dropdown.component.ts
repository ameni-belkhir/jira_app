import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';
import { SafeImagePipe } from '../../../pipe/safe-image.pipe';

/**
 * Inline SVG data URI for a generic anonymous user avatar.
 * Used as ultimate fallback when the image URL is missing or returns 404.
 */
const DEFAULT_AVATAR_DATA_URI = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='50' fill='%23e2e8f0'/%3E%3Ctext x='50' y='58' text-anchor='middle' font-size='38' fill='%2394a3b8' font-family='Arial'%3E👤%3C/text%3E%3C/svg%3E`;

@Component({
  selector: 'app-user-dropdown',
  templateUrl: './user-dropdown.component.html',
  imports:[CommonModule, RouterModule, SafeImagePipe]
})
export class UserDropdownComponent implements OnInit, OnDestroy {
  isOpen = false;
  userName = 'User';
  userEmail = '';
  userAvatar = DEFAULT_AVATAR_DATA_URI;
  private storageListener: (() => void) | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.userEmail = this.authService.getEmail() || '';
    this.loadUserFromStorage();

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

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}
