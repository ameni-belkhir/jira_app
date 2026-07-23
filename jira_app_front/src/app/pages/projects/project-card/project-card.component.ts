import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import type { BackendProject } from '../../../services/project.service';

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './project-card.component.html',
  styles: ``
})
export class ProjectCardComponent {
  @Input({ required: true }) project!: BackendProject;

  get progressPercent(): number {
    if (!this.project.totalTickets || this.project.totalTickets === 0) return 0;
    return Math.round(((this.project.ticketCount || 0) / this.project.totalTickets) * 100);
  }
}
