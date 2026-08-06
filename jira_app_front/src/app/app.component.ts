import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from './services/auth.service';
import { SignalRService } from './services/signalr.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'Angular Ecommerce Dashboard | TailAdmin';

  private authService = inject(AuthService);
  private signalRService = inject(SignalRService);
  private router = inject(Router);

ngOnInit(): void {
    // Verify authentication on application startup.
    // If no valid token exists, redirect to login and clear browser history
    // to prevent back-button access to protected pages.
    if (this.authService.isAuthenticated) {
      // Already authenticated (e.g. page refresh), start SignalR.
      this.signalRService.startConnection();
      // Rafraîchit SILENCIEUSEMENT les permissions depuis le backend (cas F5 /
      // retour sur l'app sans re-login) pour garantir que localStorage['permissions']
      // reflète toujours la table UserPermissions en base.
      this.authService.refreshPermissionsSilently();
    } else {
      const token = this.authService.getToken();
      if (!token) {
        this.router.navigate(['/login'], { replaceUrl: true });
      }
    }
  }
}
