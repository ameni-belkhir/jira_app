import { Injectable, signal } from '@angular/core';
import { GeneratedProjectPlan } from '../../services/gemini.service';

/**
 * Pont de communication entre le Chatbot (layout) et les formulaires de
 * création de projet (composants routés via le router-outlet).
 *
 * Comme le chatbot est un sibling du router-outlet dans le layout, on ne
 * peut pas utiliser un @Output direct. Ce service partagé (singleton root)
 * diffuse le plan de projet généré par l'IA vers n'importe quel composant
 * qui s'abonne, quel que soit l'emplacement dans l'arborescence Angular.
 */
@Injectable({ providedIn: 'root' })
export class ProjectPlanBridgeService {
  /** Plan de projet généré par l'IA, disponible pour pré-remplir un formulaire. */
  private readonly planSignal = signal<GeneratedProjectPlan | null>(null);

  /** Lecture seule du plan courant. */
  readonly plan = this.planSignal.asReadonly();

  /** Stocke le plan généré par le chatbot. */
  setPlan(plan: GeneratedProjectPlan | null): void {
    this.planSignal.set(plan);
  }

  /** Efface le plan stocké (après application au formulaire, par ex.). */
  clearPlan(): void {
    this.planSignal.set(null);
  }

  /** Indique si un plan est actuellement disponible. */
  hasPlan(): boolean {
    return this.planSignal() !== null;
  }
}
