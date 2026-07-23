import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-user-dropdown',
  templateUrl: './user-dropdown.component.html',
  imports:[CommonModule,RouterModule]
})
export class UserDropdownComponent implements OnInit, OnDestroy {
  isOpen = false;
  userName = 'User';
  userEmail = '';
  userAvatar = '/images/user/owner.png';
  private storageListener: (() => void) | null = null;

  constructor(private authService: AuthService) {}

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
    if (storedAvatar) {
      this.userAvatar = storedAvatar;
    }
  }

  toggleDropdown() {
    this.isOpen = !this.isOpen;
  }

  closeDropdown() {
    this.isOpen = false;
  }
}
