import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Modèle d'un ticket généré par l'IA (Gemini).
 * Correspond exactement au schéma JSON de `GeneratedTicketDto` côté backend.
 */
export interface GeneratedTicket {
  /** Intitulé du ticket. */
  titre: string;
  /** Description détaillée du ticket. */
  description: string;
  /** Priorité : "BAS" | "MOYENNE" | "HAUTE" | "CRITIQUE". */
  priority: string;
}

/**
 * Modèle d'un sprint généré par l'IA (Gemini).
 * Correspond à `GeneratedSprintDto` côté backend.
 */
export interface GeneratedSprint {
  /** Nom du sprint (ex: "Sprint 1"). */
  name: string;
  /** Objectif du sprint. */
  goal?: string | null;
  /** Tickets du sprint. */
  tickets: GeneratedTicket[];
}

/**
 * Plan de projet complet généré par l'IA (Gemini).
 * Correspond à `GeneratedProjectDto` côté backend.
 */
export interface GeneratedProjectPlan {
  /** Nom du projet. */
  projectName: string;
  /** Description du projet. */
  projectDescription: string;
  /** Sprints du projet (avec leurs tickets). */
  sprints: GeneratedSprint[];
}

/**
 * Réponse de confirmation de création du projet (POST /api/gemini/confirm-project-plan).
 */
export interface ConfirmProjectPlanResponse {
  projectId: number;
  projectName: string;
  sprintCount: number;
  ticketCount: number;
}

/**
 * Service d'interface avec le backend Gemini (côté frontend).
 *
 * Aucune clé API n'est gérée ici : le backend `.NET` détient la clé Gemini et
 * expose des endpoints authentifiés. Ce service ne fait que consommer ces
 * endpoints REST.
 */
@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Génère un plan de projet complet (sprints + tickets) via l'IA.
   * POST /api/gemini/generate-project-plan
   * Rôles autorisés : ScrumMaster, Admin.
   */
  generateProjectPlan(prompt: string): Observable<GeneratedProjectPlan> {
    return this.http.post<GeneratedProjectPlan>(`${this.apiUrl}/gemini/generate-project-plan`, { prompt });
  }

  /**
   * Génère des sprints/tickets à ajouter à un projet EXISTANT via l'IA.
   * POST /api/gemini/projects/{projectId}/generate-sprint-plan
   * Rôles autorisés : ScrumMaster, Senior (membres du projet).
   */
  generateSprintPlan(projectId: number, prompt: string): Observable<GeneratedProjectPlan> {
    return this.http.post<GeneratedProjectPlan>(
      `${this.apiUrl}/gemini/projects/${projectId}/generate-sprint-plan`,
      { prompt }
    );
  }

  /**
   * Confirme et crée réellement le projet + sprints + tickets à partir du plan (édité ou non).
   * POST /api/gemini/confirm-project-plan
   * Rôles autorisés : ScrumMaster, Admin.
   */
  confirmProjectPlan(plan: GeneratedProjectPlan): Observable<ConfirmProjectPlanResponse> {
    return this.http.post<ConfirmProjectPlanResponse>(`${this.apiUrl}/gemini/confirm-project-plan`, plan);
  }
}
