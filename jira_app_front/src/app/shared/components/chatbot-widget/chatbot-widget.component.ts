import { Component, signal, inject, ElementRef, ViewChild, AfterViewChecked, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, throwError } from 'rxjs';
import { GeminiService, GeneratedProjectPlan } from '../../../services/gemini.service';
import { NotificationService } from '../../services/notification.service';
import { ProjectPlanBridgeService } from '../../services/project-plan-bridge.service';

interface ChatMessage {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

/**
 * Widget flottant de chatbot IA (option 1).
 * Bouton flottant en bas à droite qui ouvre une fenêtre de chat.
 * Utilise GeminiService.generateProjectPlan() pour générer une réponse IA
 * à partir du prompt de l'utilisateur.
 *
 * À la réception d'un plan de projet généré par l'IA :
 * - émet l'événement @Output() projectPlanGenerated,
 * - et le diffuse via le ProjectPlanBridgeService pour que les formulaires
 *   de création de projet (composants routés) puissent se pré-remplir.
 */
@Component({
  selector: 'app-chatbot-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot-widget.component.html',
  styles: ``,
})
export class ChatbotWidgetComponent implements AfterViewChecked {
  private geminiService = inject(GeminiService);
  private notification = inject(NotificationService);
  private bridge = inject(ProjectPlanBridgeService);

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  /** Événement émis avec le JSON du plan de projet généré par l'IA. */
  @Output() projectPlanGenerated = new EventEmitter<GeneratedProjectPlan>();

  isOpen = signal(false);
  input = '';
  loading = signal(false);
  error = signal('');

  /** Plan de projet courant généré, disponible pour être appliqué au formulaire. */
  currentPlan = signal<GeneratedProjectPlan | null>(null);

  messages = signal<ChatMessage[]>([
    {
      id: 1,
      text: 'Bonjour ! Je suis votre assistant IA. Décrivez un projet ou une fonctionnalité, et je générerai un plan de projet (sprints + tickets) pour vous.',
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);

  private nextId = 2;

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  toggle(): void {
    this.isOpen.update((v) => !v);
  }

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  onKeydown(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  send(): void {
    const text = this.input.trim();
    if (!text || this.loading()) return;

    this.pushMessage(text, 'user');
    this.input = '';
    this.loading.set(true);
    this.error.set('');

    this.handlePlanGeneration(text);
  }

  /**
   * Génère le plan de projet via GeminiService.
   * Un opérateur RxJS catchError intercepte les erreurs HTTP (dont le 502)
   * au niveau du flux et produit un message d'erreur propre dans la fenêtre
   * de chat, au lieu d'un crash silencieux.
   */
  private handlePlanGeneration(text: string): void {
    this.geminiService.generateProjectPlan(text)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          const msg = this.extractError(err);
          this.error.set(msg);
          this.pushMessage(msg, 'bot');
          this.notification.error(msg);
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (plan) => {
          // Stocke le plan dans le bridge pour pré-remplissage des formulaires
          this.currentPlan.set(plan);
          this.bridge.setPlan(plan);
          // Émet l'événement avec le JSON du plan
          this.projectPlanGenerated.emit(plan);

          const reply = this.formatPlanReply(plan);
          this.pushMessage(reply, 'bot');
        },
      });
  }

private saving = signal(false);

  /**
   * Applique le plan généré au formulaire de projet.
   * Le plan est déjà stocké dans le bridge ; le bouton "Appliquer au formulaire"
   * navigue simplement vers la création de projet si besoin.
   */
  applyPlan(): void {
    const plan = this.currentPlan();
    if (!plan || this.saving()) return;

    this.saving.set(true);
    this.notification.loading('Création du projet à partir du plan IA…');

    this.geminiService.confirmProjectPlan(plan)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (res) => {
          this.notification.success(`Projet « ${res.projectName} » créé avec ${res.sprintCount} sprint(s) et ${res.ticketCount} ticket(s).`);
          this.bridge.clearPlan();
          this.currentPlan.set(null);
          this.close();
        },
        error: (err: HttpErrorResponse) => {
          const msg = this.extractError(err);
          this.notification.error(msg);
          this.pushMessage(msg, 'bot');
        },
      });
  }

  // ==================== HELPERS ====================

  private pushMessage(text: string, sender: 'user' | 'bot'): void {
    this.messages.update((msgs) => [
      ...msgs,
      { id: this.nextId++, text, sender, timestamp: new Date() },
    ]);
  }

  /** Formate un GeneratedProjectPlan en réponse lisible. */
  private formatPlanReply(plan: any): string {
    const name = plan?.projectName || 'Projet';
    const description = plan?.projectDescription || '';
    const sprints = plan?.sprints || [];
    const ticketCount = sprints.reduce((acc: number, s: any) => acc + (s?.tickets?.length || 0), 0);

    let reply = `🤖 J\u2019ai généré un plan pour « ${name} » :\n\n`;
    if (description) reply += `📋 ${description}\n\n`;
    reply += `📦 ${sprints.length} sprint(s) — 🎫 ${ticketCount} ticket(s)\n\n`;

    sprints.forEach((sprint: any, idx: number) => {
      reply += `— Sprint ${idx + 1}: ${sprint?.name || 'Sans nom'}`;
      if (sprint?.goal) reply += ` (${sprint.goal})`;
      reply += `\n`;
      (sprint?.tickets || []).forEach((t: any) => {
        reply += `   • ${t?.titre || 'Sans titre'} [${t?.priority || 'MOYENNE'}]\n`;
      });
    });

    reply += `\nVoulez-vous que je crée ce projet ? Contactez un ScrumMaster pour le confirmer.`;
    return reply;
  }

  private extractError(err: HttpErrorResponse): string {
    if (err.status === 0) return 'Impossible de se connecter au serveur.';
    if (err.status === 502) return 'Le service d\u2019IA est temporairement indisponible. Réessayez plus tard.';
    if (err.status === 403) return 'Vous n\u2019avez pas la permission d\u2019utiliser cette fonctionnalité.';
    const backend = (err.error as any)?.error;
    if (backend) return backend;
    return 'Échec de la génération du plan. Réessayez.';
  }

  private scrollToBottom(): void {
    try {
      this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
    } catch (e) { /* ignore */ }
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
