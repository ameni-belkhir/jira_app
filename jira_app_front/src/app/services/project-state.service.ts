import { Injectable, inject, signal, computed } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { ProjectService } from './project.service';

/**
 * État global du projet / sprint actuellement sélectionné dans l'application.
 *
 * Consommé principalement par le Sidebar pour construire dynamiquement
 * les routes « Backlog » et « Tickets (Kanban) » :
 *   /projects/:projectId/backlog
 *   /projects/:projectId/sprint/:sprintId/kanban
 *
 * Le contexte est mémorisé dans le localStorage (`active_project_id`,
 * `active_sprint_id`, `active_project_name`) pour rester cohérent après un
 * rechargement de la page, et mis à jour par les pages (Backlog, Sprint Kanban).
 * `ensureDefaults()` initialise le contexte avec le premier projet + sprint actif.
 */
@Injectable({ providedIn: 'root' })
export class ProjectStateService {
  private projectService = inject(ProjectService);
  private router = inject(Router);

  private readonly PROJECT_ID_KEY = 'active_project_id';
  private readonly SPRINT_ID_KEY = 'active_sprint_id';
  private readonly PROJECT_NAME_KEY = 'active_project_name';

  /** Projet actuellement sélectionné (ex: Backlog / Kanban ouvert). */
  readonly selectedProjectId = signal<number | null>(this.readNumber(this.PROJECT_ID_KEY));

  /** Sprint actuellement sélectionné (ex: Kanban ouvert). */
  readonly selectedSprintId = signal<number | null>(this.readNumber(this.SPRINT_ID_KEY));

  /** Nom du projet actuellement sélectionné (affichage / liens). */
  readonly activeProjectName = signal<string | null>(localStorage.getItem(this.PROJECT_NAME_KEY));

  /** Signal dérivé : route Kanban du contexte courant (fallback : `/projects`). */
  readonly kanbanRoute = computed<string>(() => {
    const pId = this.selectedProjectId();
    const sId = this.selectedSprintId();
    if (pId != null && sId != null) {
      return `/projects/${pId}/sprint/${sId}/kanban`;
    }
    return '/projects';
  });

  /** Émis à chaque changement de contexte (permet au Sidebar de se recalculer). */
  private changesSubject = new BehaviorSubject<void>(undefined);
  readonly changes$ = this.changesSubject.asObservable();

  /** Lit un identifiant numérique depuis le localStorage (ou `null`). */
  private readNumber(key: string): number | null {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  }

  setProject(projectId: number, projectName?: string): void {
    let changed = false;
    if (this.selectedProjectId() !== projectId) {
      this.selectedProjectId.set(projectId);
      localStorage.setItem(this.PROJECT_ID_KEY, String(projectId));
      changed = true;
    }
    if (projectName != null && this.activeProjectName() !== projectName) {
      this.activeProjectName.set(projectName);
      localStorage.setItem(this.PROJECT_NAME_KEY, projectName);
      changed = true;
    }
    if (changed) this.changesSubject.next(undefined);
  }

  setSprint(sprintId: number): void {
    if (this.selectedSprintId() !== sprintId) {
      this.selectedSprintId.set(sprintId);
      localStorage.setItem(this.SPRINT_ID_KEY, String(sprintId));
      this.changesSubject.next(undefined);
    }
  }

  setContext(projectId: number, sprintId?: number, projectName?: string): void {
    let changed = false;
    if (this.selectedProjectId() !== projectId) {
      this.selectedProjectId.set(projectId);
      localStorage.setItem(this.PROJECT_ID_KEY, String(projectId));
      changed = true;
    }
    if (sprintId != null && this.selectedSprintId() !== sprintId) {
      this.selectedSprintId.set(sprintId);
      localStorage.setItem(this.SPRINT_ID_KEY, String(sprintId));
      changed = true;
    }
    if (projectName != null && this.activeProjectName() !== projectName) {
      this.activeProjectName.set(projectName);
      localStorage.setItem(this.PROJECT_NAME_KEY, projectName);
      changed = true;
    }
    if (changed) this.changesSubject.next(undefined);
  }

  /** Route Backlog du projet sélectionné (fallback : `/projects`). */
  getBacklogRoute(): string {
    const projectId = this.selectedProjectId();
    return projectId != null ? `/projects/${projectId}/backlog` : '/projects';
  }

  /** Route Kanban du sprint sélectionné, ou `null` si le contexte est incomplet. */
  getKanbanRoute(): string | null {
    const projectId = this.selectedProjectId();
    const sprintId = this.selectedSprintId();
    if (projectId == null || sprintId == null) return null;
    return `/projects/${projectId}/sprint/${sprintId}/kanban`;
  }

  /** Réinitialise le contexte projet / sprint (et le localStorage associé). */
  clear(): void {
    this.selectedProjectId.set(null);
    this.selectedSprintId.set(null);
    this.activeProjectName.set(null);
    localStorage.removeItem(this.PROJECT_ID_KEY);
    localStorage.removeItem(this.SPRINT_ID_KEY);
    localStorage.removeItem(this.PROJECT_NAME_KEY);
    this.changesSubject.next(undefined);
  }

  /**
   * Initialise le contexte avec le premier projet (et son premier sprint actif)
   * si aucun projet n'est déjà sélectionné.
   * Si l'utilisateur n'a aucun projet, nettoie le state et redirige vers /projects.
   */
  async ensureDefaults(): Promise<void> {
    if (this.selectedProjectId() != null) return;
    try {
      const projects = await firstValueFrom(this.projectService.getProjects());
      if (!projects.length) {
        this.clear();
        this.router.navigate(['/projects']);
        return;
      }
      this.setProject(projects[0].id, projects[0].nom);
      try {
        const sprints = await firstValueFrom(this.projectService.getSprints(projects[0].id));
        const active =
          sprints.find((s) => /active|en\s?cours|actif/i.test(s.status || '')) || sprints[0];
        if (active) this.setSprint(active.id);
      } catch {
        // Aucun sprint → le lien Tickets restera sur /projects.
      }
    } catch {
      // Serveur injoignable → on garde le fallback /projects.
    }
  }
}
