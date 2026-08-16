import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  signal,
  computed,
  inject,
  ViewChild,
  ElementRef,
  PLATFORM_ID,
  DestroyRef,
} from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { ProjectCardComponent } from '../projects/project-card/project-card.component';
import { ProjectService, BackendProject, BacklogSprint, BacklogTicket } from '../../services/project.service';
import { SprintService } from '../../services/sprint.service';
import { TicketService } from '../../services/ticket.service';
import { AdminService, AdminStats } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../shared/services/notification.service';
import { ProjectStateService } from '../../services/project-state.service';

// ==================== Helpers ====================
const DAY_MS = 86400000;

/** Un sprint est « en cours » s'il a été démarré. */
function isActiveSprint(status: string): boolean {
  const s = (status || '').toLowerCase();
  return s === 'active' || s === 'in_progress' || s === 'in-progress' || s === 'en_cours' || s === 'en cours' || s === 'started' || s === 'begun';
}

/** Un ticket est « terminé » (done). */
function isDoneStatus(status: string): boolean {
  const s = (status || '').toLowerCase();
  return s === 'done' || s === 'completed' || s === 'termine' || s === 'terminé' || s === 'fait' || s === 'closed' || s === 'resolu' || s === 'résolu';
}

/** Un ticket est « en cours » (in progress). */
function isInProgressStatus(status: string): boolean {
  const s = (status || '').toLowerCase();
  return s === 'inprogress' || s === 'in-progress' || s === 'en_cours' || s === 'en cours' || s === 'progress' || s === 'doing' || s === 'started' || s === 'blocked';
}

/** Poids (story points approximatif) d'un ticket selon sa priorité. */
function storyPointsOf(ticket: BacklogTicket): number {
  switch ((ticket.priority || '').toLowerCase()) {
    case 'critique':
    case 'critical':
      return 5;
    case 'haute':
    case 'high':
      return 3;
    case 'moyenne':
    case 'medium':
    case 'moyen':
      return 2;
    default:
      return 1;
  }
}

interface BurnDownPoint {
  label: string;
  ideal: number;
  actual: number;
}

interface StatusSlice {
  category: string;
  value: number;
}

/** Construit la courbe idéale + réelle du burn-down d'un sprint. */
function buildBurnDown(sprint: BacklogSprint, tickets: BacklogTicket[]): BurnDownPoint[] {
  const total = tickets.reduce((sum, t) => sum + storyPointsOf(t), 0);
  const remaining = tickets.filter((t) => !isDoneStatus(t.status)).reduce((sum, t) => sum + storyPointsOf(t), 0);
  const start = sprint.startDate ? new Date(sprint.startDate) : null;
  const end = sprint.endDate ? new Date(sprint.endDate) : null;

  if (!start || !end || end.getTime() <= start.getTime()) {
    return [
      { label: 'Début', ideal: total, actual: total },
      { label: 'Aujourd’hui', ideal: total, actual: remaining },
      { label: 'Fin', ideal: total, actual: remaining },
    ];
  }

  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  const todayDay = Math.max(0, Math.min(totalDays, Math.floor((Date.now() - start.getTime()) / DAY_MS)));

  const points: BurnDownPoint[] = [];
  for (let d = 0; d <= totalDays; d++) {
    const ideal = Math.max(0, Math.round(total * (1 - d / totalDays)));
    let actual: number;
    if (d === 0) {
      actual = total;
    } else if (d <= todayDay) {
      actual = todayDay === 0 ? remaining : Math.round(total + (remaining - total) * (d / todayDay));
    } else {
      actual = remaining;
    }
    const date = new Date(start.getTime() + d * DAY_MS);
    points.push({
      label: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      ideal,
      actual,
    });
  }
  return points;
}

// ==================== Composant ====================
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule, ProjectCardComponent],
  templateUrl: './dashboard.component.html',
  styles: ``,
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  // Projects from backend
  projects = signal<BackendProject[]>([]);
  loading = signal(false);
  error = signal('');

  private notification = inject(NotificationService);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);
  private sprintService = inject(SprintService);
  private ticketService = inject(TicketService);

  // ==================== Analytics ====================
  selectedProjectId = signal<number | null>(null);
  sprintsByProject = signal<Record<number, BacklogSprint[]>>({});
  trackedTickets = signal<BacklogTicket[]>([]);
  analyticsLoading = signal(false);
  analyticsError = signal('');

  @ViewChild('burnDownChart') burnDownChartRef!: ElementRef<HTMLDivElement>;
  @ViewChild('statusPie') statusPieRef!: ElementRef<HTMLDivElement>;

  private burnDownChartInstance: am5.Root | null = null;
  private statusPieInstance: am5.Root | null = null;

  /** Projets pris en compte (un seul si un filtre projet est actif). */
  private selectedProjects = computed<BackendProject[]>(() => {
    const selected = this.selectedProjectId();
    if (selected == null) return this.projects();
    return this.projects().filter((p) => p.id === selected);
  });

  /** Sprints dans le périmètre (projet sélectionné ou tous les projets). */
  private selectedSprints = computed<BacklogSprint[]>(() => {
    const map = this.sprintsByProject();
    const selected = this.selectedProjectId();
    if (selected == null) {
      return this.projects().flatMap((p) => map[p.id] ?? []);
    }
    return map[selected] ?? [];
  });

  /** Tickets du périmètre courant (source des KPIs). */
  allTickets = computed<BacklogTicket[]>(() =>
    this.selectedSprints().flatMap((s) => s.tickets ?? [])
  );

  /** Sprint suivi : premier sprint en cours, sinon premier sprint du périmètre. */
  trackedSprint = computed<BacklogSprint | null>(() => {
    const sprints = this.selectedSprints();
    return sprints.find((s) => isActiveSprint(s.status)) ?? sprints[0] ?? null;
  });

  /** Tickets du sprint suivi (fraîchement rechargés si disponibles). */
  private chartTickets = computed<BacklogTicket[]>(() => {
    const tracked = this.trackedTickets();
    if (tracked.length) return tracked;
    return this.trackedSprint()?.tickets ?? [];
  });

  // ---- KPI 1 : Projets actifs ----
  kpiActiveProjects = computed<number>(() => this.selectedProjects().length);
  kpiProjectsEvolution = computed<{ withActiveSprint: number; total: number }>(() => {
    const map = this.sprintsByProject();
    const projects = this.selectedProjects();
    const total = projects.length;
    const withActiveSprint = projects.filter((p) => (map[p.id] ?? []).some((s) => isActiveSprint(s.status))).length;
    return { withActiveSprint, total };
  });

  // ---- KPI 2 : Sprints en cours + taux d'achèvement ----
  kpiSprintsInProgress = computed<number>(() =>
    this.selectedSprints().filter((s) => isActiveSprint(s.status)).length
  );
  kpiSprintCompletionRate = computed<number>(() => {
    const tickets = this.allTickets();
    if (!tickets.length) return 0;
    const done = tickets.filter((t) => isDoneStatus(t.status)).length;
    return Math.round((done / tickets.length) * 100);
  });

  // ---- KPI 3 : Tickets ouverts vs terminés ----
  kpiOpenTickets = computed<number>(() => this.allTickets().filter((t) => !isDoneStatus(t.status)).length);
  kpiClosedTickets = computed<number>(() => this.allTickets().filter((t) => isDoneStatus(t.status)).length);
  kpiResolutionRate = computed<number>(() => {
    const tickets = this.allTickets();
    if (!tickets.length) return 0;
    return Math.round((this.kpiClosedTickets() / tickets.length) * 100);
  });

  // ---- KPI 4 : Charge de travail (tickets / développeur) ----
  private developerCount = computed<number>(() => {
    const members = this.selectedProjects().flatMap((p) => p.members ?? []);
    const devs = new Set<number>();
    members.forEach((m) => {
      const r = (m.roleInProject || '').toLowerCase();
      if (r === 'developer' || r === 'dev') devs.add(m.userId);
    });
    return devs.size || new Set(members.map((m) => m.userId)).size || 0;
  });
  kpiWorkload = computed<number>(() => {
    const tickets = this.allTickets();
    if (!tickets.length) return 0;
    const assignees = new Set<string>();
    tickets.forEach((t) => {
      if (t.assignedTo) assignees.add(t.assignedTo);
    });
    const devs = assignees.size || this.developerCount();
    if (!devs) return 0;
    return Math.round((tickets.length / devs) * 10) / 10;
  });

  // ---- Graphiques ----
  burnDownData = computed<BurnDownPoint[]>(() => {
    const sprint = this.trackedSprint();
    if (!sprint) return [];
    return buildBurnDown(sprint, this.chartTickets());
  });
  velocity = computed<{ completed: number; total: number }>(() => {
    const tickets = this.chartTickets();
    const total = tickets.reduce((sum, t) => sum + storyPointsOf(t), 0);
    const completed = tickets.filter((t) => isDoneStatus(t.status)).reduce((sum, t) => sum + storyPointsOf(t), 0);
    return { completed, total };
  });
  velocityRate = computed<number>(() => {
    const { completed, total } = this.velocity();
    if (!total) return 0;
    return Math.round((completed / total) * 100);
  });
  statusPieData = computed<StatusSlice[]>(() => {
    const tickets = this.allTickets();
    const todo = tickets.filter((t) => !isInProgressStatus(t.status) && !isDoneStatus(t.status)).length;
    const inProgress = tickets.filter((t) => isInProgressStatus(t.status)).length;
    const done = tickets.filter((t) => isDoneStatus(t.status)).length;
    return [
      { category: 'À faire', value: todo },
      { category: 'En cours', value: inProgress },
      { category: 'Terminé', value: done },
    ].filter((s) => s.value > 0);
  });

  // ---- Proximité date de fin ----
  sprintDeadline = computed<{ name: string; progress: number; remainingDays: number } | null>(() => {
    const sprint = this.trackedSprint();
    if (!sprint) return null;
    const start = sprint.startDate ? new Date(sprint.startDate) : null;
    const end = sprint.endDate ? new Date(sprint.endDate) : null;
    if (!start || !end || end.getTime() <= start.getTime()) return null;
    const total = end.getTime() - start.getTime();
    const elapsed = Math.min(Math.max(Date.now() - start.getTime(), 0), total);
    const progress = Math.round((elapsed / total) * 100);
    const remainingDays = Math.max(0, Math.ceil((end.getTime() - Date.now()) / DAY_MS));
    return { name: sprint.name, progress, remainingDays };
  });
  deadlineClass = computed<string>(() => {
    const d = this.sprintDeadline();
    if (!d) return '';
    return d.remainingDays >= 3
      ? 'text-success-600 dark:text-success-400'
      : d.remainingDays >= 1
        ? 'text-warning-600 dark:text-warning-400'
        : 'text-error-600 dark:text-error-400';
  });
  deadlineBarClass = computed<string>(() => {
    const d = this.sprintDeadline();
    if (!d) return '';
    return d.remainingDays >= 3
      ? 'bg-success-500'
      : d.remainingDays >= 1
        ? 'bg-warning-500'
        : 'bg-error-500';
  });

  // ==================== Statistiques globales (migrées depuis StatisticsComponent) ====================
  @ViewChild('roleChart') roleChartRef!: ElementRef<HTMLDivElement>;
  @ViewChild('statusChart') statusChartRef!: ElementRef<HTMLDivElement>;

  /** L'utilisateur peut-il consulter les statistiques globales (permission backend). */
  canViewStats = false;
  stats = signal<AdminStats | null>(null);
  statsLoading = signal(false);
  statsError = signal('');

  private roleChartInstance: am5.Root | null = null;
  private statusChartInstance: am5.Root | null = null;

  constructor(
    private projectService: ProjectService,
    private authService: AuthService,
    private router: Router,
    private adminService: AdminService,
    private projectState: ProjectStateService
  ) {}

  ngOnInit(): void {
    // Only load projects if the user is authenticated
    // (the AuthGuard on the route should already prevent unauthenticated access,
    //  but this is an additional safety net to avoid unnecessary API calls)
    if (!this.authService.isAuthenticated) {
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }
    this.canViewStats = this.authService.hasPermission('statistics');
    this.loadProjects();
    if (this.canViewStats) {
      this.loadStats();
    }
  }

  ngAfterViewInit(): void {
    if (this.canViewStats && this.stats()) {
      this.renderCharts();
    }
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.renderAnalyticsCharts(), 100);
    }
  }

  ngOnDestroy(): void {
    this.disposeCharts();
    this.disposeAnalyticsCharts();
  }

  loadProjects(): void {
    this.loading.set(true);
    this.error.set('');
    this.notification.loading('Chargement des projets…');

    this.projectService.getProjects()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loading.set(false);
          this.notification.dismiss();
        })
      )
      .subscribe({
        next: (data) => {
          this.projects.set(data);
          this.notification.success('Projets chargés avec succès.');
          this.loadSprintsForAll();
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 0
            ? 'Impossible de se connecter au serveur.'
            : err.status === 401 || err.status === 403
              ? 'Session expirée.'
              : err.status === 500
                ? 'Serveur indisponible.'
                : 'Échec du chargement des projets.';
          this.error.set(msg);
          this.notification.error(msg);
          if (err.status === 401 || err.status === 403) {
            this.router.navigate(['/login']);
          }
        }
      });
  }

  loadStats(): void {
    this.statsLoading.set(true);
    this.statsError.set('');

    this.adminService.getStats()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.statsLoading.set(false);
        })
      )
      .subscribe({
        next: (data) => {
          this.stats.set(data);
          if (isPlatformBrowser(this.platformId)) {
            setTimeout(() => this.renderCharts(), 100);
          }
        },
        error: (err: HttpErrorResponse) => {
          const msg = err.status === 0
            ? 'Impossible de se connecter au serveur.'
            : 'Échec du chargement des statistiques.';
          this.statsError.set(msg);
        }
      });
  }

  // ==================== Analytics data loading ====================
  private loadSprintsForAll(): void {
    const projects = this.projects();
    this.analyticsError.set('');
    if (!projects.length) {
      this.sprintsByProject.set({});
      this.trackedTickets.set([]);
      this.analyticsLoading.set(false);
      return;
    }

    this.analyticsLoading.set(true);
    forkJoin(projects.map((p) => this.sprintService.getSprints(p.id)))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.analyticsLoading.set(false))
      )
      .subscribe({
        next: (results) => {
          const map: Record<number, BacklogSprint[]> = {};
          projects.forEach((p, i) => {
            map[p.id] = results[i] ?? [];
          });
          this.sprintsByProject.set(map);
          this.loadTrackedSprintTickets();
        },
        error: () => {
          this.analyticsError.set('Impossible de charger les données des sprints.');
          this.notification.error('Impossible de charger les données des sprints.');
        }
      });
  }

  private loadTrackedSprintTickets(): void {
    this.trackedTickets.set([]);
    const sprint = this.trackedSprint();
    if (!sprint) {
      this.scheduleChartRender();
      return;
    }
    this.ticketService.getTicketsBySprint(sprint.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tickets) => {
          this.trackedTickets.set(tickets);
          this.scheduleChartRender();
        },
        error: () => {
          this.trackedTickets.set(sprint.tickets ?? []);
          this.scheduleChartRender();
        }
      });
  }

  onProjectFilterChange(projectId: number | null): void {
    this.selectedProjectId.set(projectId);
    this.loadTrackedSprintTickets();
  }

  private scheduleChartRender(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    setTimeout(() => this.renderAnalyticsCharts(), 50);
  }

  private renderAnalyticsCharts(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.disposeAnalyticsCharts();

    // Burn-down chart
    if (this.burnDownChartRef?.nativeElement && this.burnDownData().length > 1) {
      const root = am5.Root.new(this.burnDownChartRef.nativeElement);
      root.setThemes([am5themes_Animated.new(root)]);

      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: false,
          panY: false,
          wheelX: 'none',
          wheelY: 'none',
          layout: root.verticalLayout,
        })
      );

      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          categoryField: 'label',
          renderer: am5xy.AxisRendererX.new(root, { minorGridEnabled: true, minGridDistance: 40 }),
        })
      );
      xAxis.data.setAll(this.burnDownData());

      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererY.new(root, {}),
          min: 0,
          extraMax: 0.1,
        })
      );

      const ideal = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: 'Idéal',
          xAxis,
          yAxis,
          categoryXField: 'label',
          valueYField: 'ideal',
          stroke: am5.color(0x94a3b8),
          connect: false,
          tooltip: am5.Tooltip.new(root, { labelText: '{name}: {valueY}' }),
        })
      );
      ideal.strokes.template.set('strokeWidth', 2);
      ideal.strokes.template.set('strokeDasharray', [6, 4]);
      ideal.data.setAll(this.burnDownData());

      const actual = chart.series.push(
        am5xy.LineSeries.new(root, {
          name: 'Reste',
          xAxis,
          yAxis,
          categoryXField: 'label',
          valueYField: 'actual',
          stroke: am5.color(0x6366f1),
          connect: false,
          tooltip: am5.Tooltip.new(root, { labelText: '{name}: {valueY}' }),
        })
      );
      actual.strokes.template.set('strokeWidth', 3);
      actual.data.setAll(this.burnDownData());
      actual.bullets.push(() =>
        am5.Bullet.new(root, {
          sprite: am5.Circle.new(root, { radius: 4, fill: am5.color(0x6366f1) }),
        })
      );

      chart.set('cursor', am5xy.XYCursor.new(root, { xAxis }));

      const legend = chart.children.push(
        am5.Legend.new(root, { centerX: am5.p50, x: am5.p50 })
      );
      legend.data.setAll(chart.series.values);

      this.burnDownChartInstance = root;
    }

    // Status pie chart
    if (this.statusPieRef?.nativeElement && this.statusPieData().length > 0) {
      const root = am5.Root.new(this.statusPieRef.nativeElement);
      root.setThemes([am5themes_Animated.new(root)]);

      const chart = root.container.children.push(
        am5percent.PieChart.new(root, {
          layout: root.verticalLayout,
        })
      );

      const series = chart.series.push(
        am5percent.PieSeries.new(root, {
          name: 'Statut',
          valueField: 'value',
          categoryField: 'category',
          alignLabels: false,
        })
      );

      series.labels.template.setAll({ text: '{category}: {value}', fontSize: 12 });
      series.ticks.template.set('visible', false);
      series.data.setAll(this.statusPieData());

      this.statusPieInstance = root;
    }
  }

  private disposeAnalyticsCharts(): void {
    if (this.burnDownChartInstance) {
      this.burnDownChartInstance.dispose();
      this.burnDownChartInstance = null;
    }
    if (this.statusPieInstance) {
      this.statusPieInstance.dispose();
      this.statusPieInstance = null;
    }
  }

  private renderCharts(): void {
    const currentStats = this.stats();
    if (!currentStats || !isPlatformBrowser(this.platformId)) return;

    this.disposeCharts();

    // Role distribution pie chart
    if (this.roleChartRef?.nativeElement) {
      const roleRoot = am5.Root.new(this.roleChartRef.nativeElement);
      roleRoot.setThemes([am5themes_Animated.new(roleRoot)]);

      const roleChart = roleRoot.container.children.push(
        am5percent.PieChart.new(roleRoot, {
          layout: am5.GridLayout.new(roleRoot, { maxColumns: 1 }),
        })
      );

      const roleSeries = roleChart.series.push(
        am5percent.PieSeries.new(roleRoot, {
          name: 'Rôle',
          valueField: 'value',
          categoryField: 'category',
          alignLabels: false,
        })
      );

      roleSeries.labels.template.setAll({
        text: '{category}: {value}',
        fontSize: 12,
      });

      roleSeries.ticks.template.set('visible', false);

      const roleData = Object.entries(currentStats.totalUsersByRole).map(([key, value]) => ({
        category: key,
        value: value,
      }));

      roleSeries.data.setAll(roleData);
      this.roleChartInstance = roleRoot;
    }

    // Ticket status distribution pie chart
    if (this.statusChartRef?.nativeElement) {
      const statusRoot = am5.Root.new(this.statusChartRef.nativeElement);
      statusRoot.setThemes([am5themes_Animated.new(statusRoot)]);

      const statusChart = statusRoot.container.children.push(
        am5percent.PieChart.new(statusRoot, {
          layout: am5.GridLayout.new(statusRoot, { maxColumns: 1 }),
        })
      );

      const statusSeries = statusChart.series.push(
        am5percent.PieSeries.new(statusRoot, {
          name: 'Statut',
          valueField: 'value',
          categoryField: 'category',
          alignLabels: false,
        })
      );

      statusSeries.labels.template.setAll({
        text: '{category}: {value}',
        fontSize: 12,
      });

      statusSeries.ticks.template.set('visible', false);

      const statusData = Object.entries(currentStats.totalTicketsByStatus).map(([key, value]) => ({
        category: key,
        value: value,
      }));

      statusSeries.data.setAll(statusData);
      this.statusChartInstance = statusRoot;
    }
  }

  private disposeCharts(): void {
    if (this.roleChartInstance) {
      this.roleChartInstance.dispose();
      this.roleChartInstance = null;
    }
    if (this.statusChartInstance) {
      this.statusChartInstance.dispose();
      this.statusChartInstance = null;
    }
  }

  // Open create project modal
  goToProjectBacklog(project: BackendProject): void {
    this.projectState.setProject(project.id);
    this.router.navigate(['/projects', project.id, 'backlog']);
  }
}
