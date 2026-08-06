import { Component, OnInit, inject, signal } from '@angular/core';
import { SidebarService } from '../../services/sidebar.service';
import { CommonModule } from '@angular/common';
import { AppSidebarComponent } from '../app-sidebar/app-sidebar.component';
import { BackdropComponent } from '../backdrop/backdrop.component';
import { RouterModule } from '@angular/router';
import { AppHeaderComponent } from '../app-header/app-header.component';
import { AuthService } from '../../../services/auth.service';
import { ChangePasswordModalComponent } from '../../components/change-password-modal/change-password-modal.component';
import { ChatbotWidgetComponent } from '../../components/chatbot-widget/chatbot-widget.component';

@Component({
  selector: 'app-layout',
  imports: [
    CommonModule,
    RouterModule,
    AppHeaderComponent,
    AppSidebarComponent,
    BackdropComponent,
    ChangePasswordModalComponent,
    ChatbotWidgetComponent
  ],
  templateUrl: './app-layout.component.html',
})

export class AppLayoutComponent implements OnInit {
  private authService = inject(AuthService);

  readonly isExpanded$;
  readonly isHovered$;
  readonly isMobileOpen$;

  showChangePasswordModal = signal(false);

  constructor(public sidebarService: SidebarService) {
    this.isExpanded$ = this.sidebarService.isExpanded$;
    this.isHovered$ = this.sidebarService.isHovered$;
    this.isMobileOpen$ = this.sidebarService.isMobileOpen$;
  }

  ngOnInit(): void {
    if (this.authService.getMustChangePassword()) {
      this.showChangePasswordModal.set(true);
    }
  }

  onPasswordChanged(): void {
    this.showChangePasswordModal.set(false);
  }

  get containerClasses() {
    return [
      'flex-1',
      'transition-all',
      'duration-300',
      'ease-in-out',
      (this.isExpanded$ || this.isHovered$) ? 'xl:ml-[290px]' : 'xl:ml-[90px]',
      this.isMobileOpen$ ? 'ml-0' : ''
    ];
  }

}
