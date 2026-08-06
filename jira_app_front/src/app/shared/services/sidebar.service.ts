import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const EXPANDED_KEY = 'sidebar_expanded';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private isExpandedSubject = new BehaviorSubject<boolean>(true);
  private isMobileOpenSubject = new BehaviorSubject<boolean>(false);
  private isHoveredSubject = new BehaviorSubject<boolean>(false);

  isExpanded$ = this.isExpandedSubject.asObservable();
  isMobileOpen$ = this.isMobileOpenSubject.asObservable();
  isHovered$ = this.isHoveredSubject.asObservable();

  constructor() {
    // Force default expanded = true on desktop (xl breakpoint = 1280px+)
    if (typeof window !== 'undefined') {
      const isDesktop = window.innerWidth >= 1280;
      this.setExpanded(isDesktop);
      // Restore persisted preference on desktop, but always default to open
      if (isDesktop) {
        const saved = localStorage.getItem(EXPANDED_KEY);
        if (saved !== null) {
          this.setExpanded(saved === 'true');
        } else {
          this.setExpanded(true);
        }
      }
    }
  }

  /** Whether the current viewport is desktop (>= 1280px) */
  isDesktop(): boolean {
    return typeof window !== 'undefined' && window.innerWidth >= 1280;
  }

  setExpanded(val: boolean) {
    this.isExpandedSubject.next(val);
    if (this.isDesktop()) {
      try {
        localStorage.setItem(EXPANDED_KEY, String(val));
      } catch {
        // localStorage unavailable (e.g. privacy mode)
      }
    }
  }

  toggleExpanded() {
    this.setExpanded(!this.isExpandedSubject.value);
  }

  setMobileOpen(val: boolean) {
    this.isMobileOpenSubject.next(val);
  }

  toggleMobileOpen() {
    this.isMobileOpenSubject.next(!this.isMobileOpenSubject.value);
  }

  setHovered(val: boolean) {
    this.isHoveredSubject.next(val);
  }
}

