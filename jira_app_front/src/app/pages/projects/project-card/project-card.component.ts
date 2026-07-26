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
}
