import { Directive, Input, TemplateRef, ViewContainerRef, inject, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

/**
 * Structural directive that conditionally includes or excludes an element
 * based on whether the authenticated user has a specific permission.
 *
 * Usage: *appHasPermission="'admin.users.view'"
 * Alternative: *appHasPermission="['admin.users.view', 'admin.users.edit']" (any match)
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class HasPermissionDirective implements OnInit, OnDestroy {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private authService = inject(AuthService);

  private permissionKeys: string[] = [];
  private subscription: Subscription | null = null;

  /** Single permission key or array of keys (any match = visible) */
  @Input() set appHasPermission(keys: string | string[]) {
    this.permissionKeys = Array.isArray(keys) ? keys : [keys];
    this.updateView();
  }

  ngOnInit(): void {
    // Re-evaluate when authentication state changes
    this.subscription = this.authService.isAuthenticated$.subscribe(() => {
      this.updateView();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private updateView(): void {
    const hasAccess = this.permissionKeys.some(key => this.authService.hasPermission(key));

    if (hasAccess) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    } else {
      this.viewContainer.clear();
    }
  }
}

