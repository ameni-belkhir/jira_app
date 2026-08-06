import { Component, OnInit, signal, inject, AfterViewInit, ViewChild, ElementRef, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminService, AdminStats } from '../../services/admin.service';
import { NotificationService } from '../../shared/services/notification.service';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

@Component({
  selector: 'app-admin-statistics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-statistics.component.html',
  styles: ``,
})
export class AdminStatisticsComponent implements OnInit, AfterViewInit {
  private adminService = inject(AdminService);
  private notification = inject(NotificationService);
  @Inject(PLATFORM_ID) private platformId = inject(PLATFORM_ID);

  @ViewChild('roleChart') roleChartRef!: ElementRef<HTMLDivElement>;
  @ViewChild('statusChart') statusChartRef!: ElementRef<HTMLDivElement>;

  stats = signal<AdminStats | null>(null);
  loading = signal(false);
  error = signal('');

  private roleChartInstance: am5.Root | null = null;
  private statusChartInstance: am5.Root | null = null;

  ngOnInit(): void {
    this.loadStats();
  }

  ngAfterViewInit(): void {
    if (this.stats()) {
      this.renderCharts();
    }
  }

  loadStats(): void {
    this.loading.set(true);
    this.error.set('');
    this.notification.loading('Chargement des statistiques…');

    this.adminService.getStats()
      .pipe(finalize(() => {
        this.loading.set(false);
        this.notification.dismiss();
      }))
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
          this.error.set(msg);
          this.notification.error(msg);
        }
      });
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
}


