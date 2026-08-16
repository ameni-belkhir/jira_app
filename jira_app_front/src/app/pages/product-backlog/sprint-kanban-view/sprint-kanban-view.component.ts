import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { SprintKanbanComponent } from '../sprint-kanban/sprint-kanban.component';
import { ProjectStateService } from '../../../services/project-state.service';

@Component({
  selector: 'app-sprint-kanban-view',
  standalone: true,
  imports: [CommonModule, RouterModule, SprintKanbanComponent],
  template: `
    <div class="p-6">
      <div class="flex items-center gap-2 text-sm mb-6">
        <a routerLink="/projects" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
          Projects
        </a>
        <span class="text-gray-300 dark:text-gray-600">/</span>
        <a [routerLink]="['/projects', projectId, 'backlog']" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
          Backlog
        </a>
        <span class="text-gray-300 dark:text-gray-600">/</span>
        <span class="font-semibold text-gray-800 dark:text-white">Sprint Kanban</span>
      </div>
      <app-sprint-kanban [sprintId]="sprintId" [projectId]="projectId" />
    </div>
  `,
  styles: ``
})
export class SprintKanbanViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private projectState = inject(ProjectStateService);

  projectId: number = 0;
  sprintId: number = 0;

  ngOnInit(): void {
    const projectIdParam = this.route.snapshot.paramMap.get('projectId');
    const sprintIdParam = this.route.snapshot.paramMap.get('sprintId');
    if (projectIdParam && sprintIdParam) {
      this.projectId = parseInt(projectIdParam, 10);
      this.sprintId = parseInt(sprintIdParam, 10);
      // Mémorise le contexte projet / sprint pour le menu (Tickets / Backlog).
      this.projectState.setContext(this.projectId, this.sprintId);
    }
  }
}
