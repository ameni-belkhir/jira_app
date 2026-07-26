import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from './services/auth.service';

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

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Verify authentication on application startup.
    // If no valid token exists, redirect to login and clear browser history
    // to prevent back-button access to protected pages.
    if (!this.authService.isAuthenticated) {
      const token = this.authService.getToken();
      if (!token) {
        this.router.navigate(['/login'], { replaceUrl: true });
      }
    }
  }
}
