import { Component, EventEmitter, Input, Output } from '@angular/core';
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
  @Input() canManageProjects: boolean = false;
  @Input() deleting: boolean = false;
  @Output() deleteProject = new EventEmitter<BackendProject>();
  @Output() editProject = new EventEmitter<BackendProject>();

  onDeleteClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.deleting) return; // Prevent multiple clicks
    this.deleteProject.emit(this.project);
  }

  onEditClick(event: MouseEvent): void {
    event.stopPropagation();
    this.editProject.emit(this.project);
  }
}
