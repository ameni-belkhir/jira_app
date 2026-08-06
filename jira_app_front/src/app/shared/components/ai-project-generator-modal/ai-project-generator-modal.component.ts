import { Component, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { Router } from '@angular/router';
import {
  GeminiService,
  GeneratedProjectPlan,
  GeneratedSprint,
  GeneratedTicket,
  ConfirmProjectPlanResponse
} from '../../../services/gemini.service';
import { NotificationService } from '../../../shared/services/notification.service';

export type AiModalStep = 'prompt' | 'loading' | 'preview' | 'confirming';

/**
 * Modale de génération de PROJET via l'IA (Gemini).
 * Accessible depuis la page Projects (uniquement si l'utilisateur peut gérer les projets).
 * Workflow : prompt → generateProjectPlan() → aperçu éditable → confirmProjectPlan() → redirection.
 */
@Component({
  selector: 'app-ai-project-generator-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-project-generator-modal.component.html',
  styles: ``
})
export class AiProjectGeneratorModalComponent {
  @Output() close = new EventEmitter<void>();

  private geminiService = inject(GeminiService);
  private notification = inject(NotificationService);
  private router = inject(Router);

/** Étape courante de la modale. */
  step = signal<AiModalStep>('prompt');

  /** État ouvert/fermé de la modale. */
  isOpen = signal(false);

  /** Champ libre de description du projet. */
  prompt = '';

  /** Plan généré par l'IA (prévisualisation éditable). */
  plan = signal<GeneratedProjectPlan | null>(null);

  /** Erreur éventuelle. */
  error = signal('');
  submitted = false;

  /** Priorités acceptées par le backend. */
  readonly priorities: string[] = ['BAS', 'MOYENNE', 'HAUTE', 'CRITIQUE'];

open(): void {
    this.reset();
    this.step.set('prompt');
    this.isOpen.set(true);
  }

  closeModal(): void {
    this.isOpen.set(false);
    this.close.emit();
    this.reset();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }

  /** Lance la génération du plan projet via l'IA. */
  onSubmit(): void {
    this.submitted = true;
    this.error.set('');
    if (!this.prompt.trim()) {
      this.notification.validation('Veuillez décrire votre projet.');
      return;
    }

    this.step.set('loading');
    this.notification.loading('Génération du plan projet par l\u2019IA…');

    this.geminiService.generateProjectPlan(this.prompt.trim())
      .pipe(finalize(() => this.notification.dismiss()))
      .subscribe({
        next: (plan) => {
          this.plan.set(this.ensureValidPlan(plan));
          this.step.set('preview');
        },
        error: (err: HttpErrorResponse) => {
          this.step.set('prompt');
          const msg = this.extractError(err);
          this.error.set(msg);
          this.notification.error(msg);
        }
      });
  }

  /** Confirme et crée réellement le projet + sprints + tickets. */
  onConfirm(): void {
    const currentPlan = this.plan();
    if (!currentPlan) return;

    this.step.set('confirming');
    this.notification.loading('Création du projet…');

    this.geminiService.confirmProjectPlan(currentPlan)
      .pipe(finalize(() => this.notification.dismiss()))
      .subscribe({
        next: (res: ConfirmProjectPlanResponse) => {
          this.notification.success(`Projet « ${res.projectName} » créé avec ${res.sprintCount} sprint(s) et ${res.ticketCount} ticket(s).`);
          this.closeModal();
          this.router.navigate(['/projects']);
        },
        error: (err: HttpErrorResponse) => {
          this.step.set('preview');
          const msg = this.extractError(err);
          this.notification.error(msg);
        }
      });
  }

  // ==================== ÉDITION DU PLAN ====================

  updateProjectName(value: string): void {
    this.plan.update((p) => (p ? { ...p, projectName: value } : p));
  }

  updateProjectDescription(value: string): void {
    this.plan.update((p) => (p ? { ...p, projectDescription: value } : p));
  }

  updateSprintName(sprintIndex: number, value: string): void {
    this.plan.update((p) => {
      if (!p) return p;
      const sprints = p.sprints.map((s, i) => (i === sprintIndex ? { ...s, name: value } : s));
      return { ...p, sprints };
    });
  }

  updateSprintGoal(sprintIndex: number, value: string): void {
    this.plan.update((p) => {
      if (!p) return p;
      const sprints = p.sprints.map((s, i) => (i === sprintIndex ? { ...s, goal: value } : s));
      return { ...p, sprints };
    });
  }

  updateTicket(sprintIndex: number, ticketIndex: number, field: keyof GeneratedTicket, value: string): void {
    this.plan.update((p) => {
      if (!p) return p;
      const sprints = p.sprints.map((s, si) => {
        if (si !== sprintIndex) return s;
        const tickets = s.tickets.map((t, ti) => (ti === ticketIndex ? { ...t, [field]: value } : t));
        return { ...s, tickets };
      });
      return { ...p, sprints };
    });
  }

  removeTicket(sprintIndex: number, ticketIndex: number): void {
    this.plan.update((p) => {
      if (!p) return p;
      const sprints = p.sprints.map((s, si) => {
        if (si !== sprintIndex) return s;
        return { ...s, tickets: s.tickets.filter((_, ti) => ti !== ticketIndex) };
      });
      return { ...p, sprints };
    });
  }

  removeSprint(sprintIndex: number): void {
    this.plan.update((p) => {
      if (!p) return p;
      return { ...p, sprints: p.sprints.filter((_, si) => si !== sprintIndex) };
    });
  }

  addTicket(sprintIndex: number): void {
    this.plan.update((p) => {
      if (!p) return p;
      const sprints = p.sprints.map((s, si) => {
        if (si !== sprintIndex) return s;
        const newTicket: GeneratedTicket = { titre: '', description: '', priority: 'MOYENNE' };
        return { ...s, tickets: [...s.tickets, newTicket] };
      });
      return { ...p, sprints };
    });
  }

  addSprint(): void {
    this.plan.update((p) => {
      if (!p) return p;
      const newSprint: GeneratedSprint = { name: '', goal: '', tickets: [] };
      return { ...p, sprints: [...p.sprints, newSprint] };
    });
  }

  // ==================== HELPERS ====================

  /** Assure que le plan retourné par l'API a bien la forme attendue. */
  private ensureValidPlan(plan: GeneratedProjectPlan): GeneratedProjectPlan {
    return {
      projectName: plan?.projectName || '',
      projectDescription: plan?.projectDescription || '',
      sprints: (plan?.sprints || []).map((s) => ({
        name: s?.name || '',
        goal: s?.goal || '',
        tickets: (s?.tickets || []).map((t) => ({
          titre: t?.titre || '',
          description: t?.description || '',
          priority: t?.priority || 'MOYENNE'
        }))
      }))
    };
  }

  private extractError(err: HttpErrorResponse): string {
    if (err.status === 0) return 'Impossible de se connecter au serveur.';
    if (err.status === 502) return 'Le service d\u2019IA est temporairement indisponible. Réessayez plus tard.';
    if (err.status === 403) return 'Vous n\u2019avez pas la permission d\u2019utiliser cette fonctionnalité.';
    const backend = (err.error as any)?.error;
    if (backend) return backend;
    return 'Échec de la génération du plan. Réessayez.';
  }

  private reset(): void {
    this.prompt = '';
    this.plan.set(null);
    this.error.set('');
    this.submitted = false;
  }
}
