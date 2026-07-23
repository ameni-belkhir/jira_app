import { Component } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { KanbanBoardComponent } from '../kanban-board/kanban-board.component';

@Component({
  selector: 'app-project-board',
  standalone: true,
  imports: [CommonModule, RouterModule, KanbanBoardComponent],
  templateUrl: './project-board.component.html',
  styles: ``
})
export class ProjectBoardComponent {
  projectId: string | null = null;

  projectNames: Record<string, string> = {
    '1': 'CRM System',
    '2': 'E-Commerce Website',
    '3': 'Mobile Application',
    '4': 'Internal HR',
    '5': 'Inventory System'
  };

  get projectName(): string {
    return this.projectId ? (this.projectNames[this.projectId] || 'Project') : 'Project';
  }

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('id');
  }
}
