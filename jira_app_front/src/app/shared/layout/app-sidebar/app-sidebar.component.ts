import { CommonModule } from '@angular/common';
import { Component, ElementRef, QueryList, ViewChildren, ChangeDetectorRef } from '@angular/core';
import { SidebarService } from '../../services/sidebar.service';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { SafeHtmlPipe } from '../../pipe/safe-html.pipe';
import { AuthService } from '../../../services/auth.service';
import { NAV_ITEMS, NavItem } from '../../config/navigation.config';
import { combineLatest, Subscription } from 'rxjs';

type SidebarNavItem = {
  name: string;
  icon: string;
  path?: string;
  new?: boolean;
  permission?: string;         // Optional: if set, item visible only when hasPermission(key)
  adminOnly?: boolean;         // Optional: if true, visible only when isAdmin()
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

@Component({
  selector: 'app-sidebar',
  imports: [
    CommonModule,
    RouterModule,
    SafeHtmlPipe,
  ],
  templateUrl: './app-sidebar.component.html',
  preserveWhitespaces: false,
})
export class AppSidebarComponent {

/**
   * Items du menu construits depuis la liste centralisée `NAV_ITEMS`.
   * Filtrage par les PERMISSIONS RÉELLES de l'utilisateur connecté
   * (`AuthService.hasPermission(item.key)`), en provenance du backend.
   *
   * Notes :
   * - Les items `adminOnly` ne sont visibles que si l'utilisateur est Admin.
   * - La logique du Backlog dynamique est conservée ci-dessous.
   */
  get navItems(): SidebarNavItem[] {
    const isAdmin = this.authService.isAdmin();

    const items: SidebarNavItem[] = NAV_ITEMS.filter(
      (item: NavItem) =>
        this.authService.hasPermission(item.key) &&
        (!item.adminOnly || isAdmin)
    ).map((item: NavItem) => ({
      name: item.label,
      icon: item.icon,
      path: item.route || undefined,
      permission: item.key,
      adminOnly: item.adminOnly,
    }));

    // Ajoute le Backlog dynamique si l'utilisateur a la permission et est sur un projet.
    const backlog = this.backlogNavItem;
    if (backlog) {
      items.push(backlog);
    }

    console.log('[SIDEBAR] Current role:', this.authService.getRoleKey());
    console.log('[SIDEBAR] Visible pages:', items.map(i => i.name));
    return items;
  }

  /** Backlog dynamique : visible lorsque l'utilisateur a la permission et est dans un projet. */
  get backlogNavItem(): SidebarNavItem | null {
    if (!this.authService.hasPermission('backlog')) {
      return null;
    }
    const match = this.router.url.match(/\/projects\/(\d+)/);
    if (!match) return null;
    const navItem = NAV_ITEMS.find((i) => i.key === 'backlog');
    if (!navItem) return null;
    return {
      name: navItem.label,
      icon: navItem.icon,
      path: `/projects/${match[1]}/backlog`,
      permission: navItem.key,
    };
  }

  // Logout item
  othersItems: SidebarNavItem[] = [
    {
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M20.75 6.5C20.75 8.57107 19.8241 10.4301 18.3432 11.7197C19.4792 13.2669 20.2073 15.1591 20.3422 17.2331C20.3885 17.9894 20.3616 18.6066 20.1426 19.1793C19.9325 19.7288 19.5062 20.2508 18.6593 20.6322C17.7359 21.0499 16.427 21.25 14.75 21.25C13.073 21.25 11.7641 21.0499 10.8407 20.6322C9.99383 20.2508 9.56752 19.7288 9.35741 19.1793C9.13841 18.6066 9.11146 17.9894 9.15778 17.2331C9.29155 15.1778 10.0085 13.3018 11.1302 11.762C10.3072 11.0895 9.66965 10.242 9.27579 9.29289C8.92133 8.44138 9.0835 7.46955 9.55121 6.60899C9.95339 5.86942 10.5904 5.22841 11.3522 4.78592C12.1615 4.31369 13.129 4.0477 14.1918 4.01613C14.5651 4.0058 14.869 4.23857 14.9313 4.56352C14.937 4.59414 14.9143 4.56961 14.8333 4.64716L16.2901 6.14041L20.7278 2.83934C20.9908 2.63562 21.37 2.70183 21.5507 2.98629C21.7271 3.26394 21.6411 3.63989 21.3537 3.8136L16.8829 6.54413L18.3442 8.04212C18.8076 8.51855 19.4015 8.86166 20.1455 9.06428C20.8752 9.26268 21.7182 9.31687 22.58 9.21446L22.669 9.20446C23.0816 9.1579 23.4463 9.43864 23.4836 9.83145C23.5209 10.2243 23.2127 10.5618 22.8001 10.6084L22.7111 10.6184C21.6949 10.7383 20.6873 10.6768 19.7984 10.4378L19.3805 18.0694C19.3605 18.4721 19.0287 18.7904 18.6201 18.7904C18.2115 18.7904 17.8797 18.4721 17.8597 18.0694L17.4418 10.4378C16.5529 10.6768 15.5453 10.7383 14.5291 10.6184L14.4401 10.6084C14.0275 10.5618 13.7193 10.2243 13.7566 9.83145C13.7939 9.43864 14.1586 9.1579 14.5712 9.20446L14.6602 9.21446C15.5026 9.31443 16.3264 9.26161 17.0411 9.06793C17.3937 8.97511 17.7214 8.85173 18.0221 8.69846L16.5753 7.2137L15.0833 8.66737C15.0032 8.74551 14.9533 8.77808 14.9292 8.751C14.9051 8.7239 14.9241 8.6507 14.9188 8.5982C14.8977 8.4087 14.8706 8.20406 14.8306 7.986C14.674 7.1301 14.3547 6.39344 13.9228 5.79218C13.5663 5.29697 13.1315 4.90509 12.6435 4.61897C12.1014 4.30012 11.4798 4.10383 10.8141 4.05001C9.53194 3.94629 8.27282 4.22818 7.18951 4.86129C6.05723 5.52524 5.25688 6.51606 4.9476 7.70772C4.63879 8.89755 4.71873 10.1998 5.21043 11.4208C5.69892 12.6322 6.57476 13.658 7.6585 14.3603L7.66858 14.367C8.24322 14.7443 8.48441 15.3822 8.39242 15.9991L8.39239 15.9993L8.36454 16.1634C8.21535 16.9626 8.67266 17.703 9.52655 18.2381L12.9628 20.3747C13.3144 20.6009 13.4169 21.0727 13.1907 21.4242C12.9645 21.7758 12.4927 21.8784 12.1412 21.6522L8.70496 19.5155C7.83466 18.9699 7.03125 18.218 6.57891 17.2521L6.5775 17.2541L4.63581 18.4555C4.27927 18.6728 3.80958 18.5589 3.5923 18.2024C3.37503 17.8458 3.48893 17.3761 3.84548 17.1589L5.79436 15.9529C5.37923 14.6937 5.32267 13.3213 5.706 12.0105C6.0925 10.6897 6.88945 9.55348 7.95962 8.69222C7.46782 7.84447 7.1562 6.87667 7.05833 5.83118C6.96764 4.86717 7.09262 3.88287 7.48204 3.00806C7.51914 2.92301 7.59557 2.8621 7.68678 2.8458C9.13506 2.58563 10.5276 2.77096 11.6396 3.23044C12.0033 3.37772 12.3396 3.55515 12.6478 3.76062L18.3432 6.28028C18.3432 6.28028 18.3432 6.28028 18.3432 6.28029C19.8241 7.56989 20.75 9.42893 20.75 11.5C20.75 15.4351 17.6575 18.25 14 18.25C13.5858 18.25 13.25 18.5858 13.25 19C13.25 19.4142 13.5858 19.75 14 19.75C18.5968 19.75 22.25 16.2841 22.25 11.5C22.25 9.57207 21.5933 7.82613 20.4804 6.5L20.75 6.5Z" fill="currentColor"></path></svg>`,
      name: "Logout",
      path: "/logout",
    },
  ];

  get allNavItems(): SidebarNavItem[] {
    return [...this.navItems, ...this.othersItems];
  }

  openSubmenu: string | null | number = null;
  subMenuHeights: { [key: string]: number } = {};
  @ViewChildren('subMenu') subMenuRefs!: QueryList<ElementRef>;

  readonly isExpanded$;
  readonly isMobileOpen$;
  readonly isHovered$;

  private subscription: Subscription = new Subscription();

  constructor(
    public sidebarService: SidebarService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) {
    this.isExpanded$ = this.sidebarService.isExpanded$;
    this.isMobileOpen$ = this.sidebarService.isMobileOpen$;
    this.isHovered$ = this.sidebarService.isHovered$;
  }

  ngOnInit() {
    // Subscribe to router events to update Backlog visibility
    this.subscription.add(
      this.router.events.subscribe(event => {
        if (event instanceof NavigationEnd) {
          this.setActiveMenuFromRoute(this.router.url);
          // Force change detection to re-evaluate backlogNavItem
          this.cdr.detectChanges();
        }
      })
    );

    // Subscribe to combined observables to close submenus when all are false
    this.subscription.add(
      combineLatest([this.isExpanded$, this.isMobileOpen$, this.isHovered$]).subscribe(
        ([isExpanded, isMobileOpen, isHovered]) => {
          if (!isExpanded && !isMobileOpen && !isHovered) {
            this.cdr.detectChanges();
          }
        }
      )
    );

    // Réactivité : recalculer le menu quand l'authentification / les permissions changent.
    this.subscription.add(
      this.authService.isAuthenticated$.subscribe(() => {
        this.cdr.detectChanges();
      })
    );
    this.subscription.add(
      this.authService.permissions$.subscribe(() => {
        this.cdr.detectChanges();
      })
    );

    // Initial load
    this.setActiveMenuFromRoute(this.router.url);
  }

  ngOnDestroy() {
    // Clean up subscriptions
    this.subscription.unsubscribe();
  }

  isActive(path: string): boolean {
    return this.router.url === path;
  }

  toggleSubmenu(section: string, index: number) {
    const key = `${section}-${index}`;

    if (this.openSubmenu === key) {
      this.openSubmenu = null;
      this.subMenuHeights[key] = 0;
    } else {
      this.openSubmenu = key;

      setTimeout(() => {
        const el = document.getElementById(key);
        if (el) {
          this.subMenuHeights[key] = el.scrollHeight;
          this.cdr.detectChanges();
        }
      });
    }
  }

  onSidebarMouseEnter() {
    this.isExpanded$.subscribe(expanded => {
      if (!expanded) {
        this.sidebarService.setHovered(true);
      }
    }).unsubscribe();
  }

  private setActiveMenuFromRoute(currentUrl: string) {
    const menuGroups = [
      { items: this.navItems, prefix: 'main' },
      { items: this.othersItems, prefix: 'others' },
    ];

    menuGroups.forEach(group => {
      group.items.forEach((nav, i) => {
        if (nav.subItems) {
          nav.subItems.forEach(subItem => {
            if (currentUrl === subItem.path) {
              const key = `${group.prefix}-${i}`;
              this.openSubmenu = key;

              setTimeout(() => {
                const el = document.getElementById(key);
                if (el) {
                  this.subMenuHeights[key] = el.scrollHeight;
                  this.cdr.detectChanges();
                }
              });
            }
          });
        }
      });
    });
  }

  onSubmenuClick() {
    this.isMobileOpen$.subscribe(isMobile => {
      if (isMobile) {
        this.sidebarService.setMobileOpen(false);
      }
    }).unsubscribe();
  }

  onNavClick(nav: SidebarNavItem): void {
    if (nav.path === '/logout') {
      this.authService.logout();
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }
    if (nav.path) {
      this.router.navigate([nav.path]);
    }
    // Close mobile sidebar after navigation
    this.isMobileOpen$.subscribe(isMobile => {
      if (isMobile) {
        this.sidebarService.setMobileOpen(false);
      }
    }).unsubscribe();
  }
}

