import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AppHeaderComponent } from '../app-header/app-header.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, AppHeaderComponent],
  template: `
    <div class="min-h-screen xl:flex">
      <div class="flex-1">
        <!-- app header start -->
        <app-header />
        <!-- app header end -->
        <div class="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">
          <router-outlet></router-outlet>
        </div>
      </div>
    </div>
  `,
  styles: ``,
})
export class AdminLayoutComponent {}

