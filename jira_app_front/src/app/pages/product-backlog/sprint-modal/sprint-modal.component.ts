import { Component, DestroyRef, ElementRef, EventEmitter, EnvironmentInjector, Input, Output, ViewChild, afterNextRender, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import type { Observable } from 'rxjs';
import flatpickr from 'flatpickr';
import { French } from 'flatpickr/dist/l10n/fr.js';
import { ProjectService, SprintUpdateRequest, BacklogSprint } from '../../../services/project.service';
import { NotificationService } from '../../../shared/services/notification.service';

@Component({
  selector: 'app-sprint-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sprint-modal.component.html',
  styles: ``
})
export class SprintModalComponent {
  @Input({ required: true }) projectId!: number;
  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  @ViewChild('startPicker') startPickerRef!: ElementRef<HTMLInputElement>;
  @ViewChild('endPicker') endPickerRef!: ElementRef<HTMLInputElement>;

  readonly isOpen = signal(false);
  readonly isEditMode = signal(false);
  readonly submitting = signal(false);

  form: FormGroup;

  private editingSprintId: number | null = null;
  private flatpickrStart: flatpickr.Instance | null = null;
  private flatpickrEnd: flatpickr.Instance | null = null;

  private readonly projectService = inject(ProjectService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(EnvironmentInjector);

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      name: ['', [Validators.required]],
      goal: [''],
      startDate: [''],
      endDate: ['']
    });
  }

  get f() {
    return this.form.controls;
  }

  open(sprint?: BacklogSprint): void {
    this.isEditMode.set(!!sprint);
    this.editingSprintId = sprint ? sprint.id : null;
    this.form.reset({
      name: sprint?.name || '',
      goal: sprint?.goal || '',
      startDate: sprint?.startDate || '',
      endDate: sprint?.endDate || ''
    });
    this.isOpen.set(true);

    // Init flatpickr after DOM renders — afterNextRender guarantees
    // that @ViewChild references are resolved (unlike setTimeout).
    afterNextRender(() => this.initFlatpickr(sprint), { injector: this.injector });
  }

  closeModal(): void {
    if (this.submitting()) return;
    this.destroyFlatpickr();
    this.isOpen.set(false);
    this.close.emit();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.value;
    const payload = {
      name: (value.name ?? '').trim(),
      goal: (value.goal ?? '').trim() || undefined,
      startDate: value.startDate || undefined,
      endDate: value.endDate || undefined
    };

    this.submitting.set(true);
    this.notification.loading(this.isEditMode() ? 'Mise à jour du sprint…' : 'Création du sprint…');

    const source$ = (this.isEditMode() && this.editingSprintId != null
      ? this.projectService.updateSprint(this.editingSprintId, payload as SprintUpdateRequest)
      : this.projectService.createSprint({ projectId: this.projectId, ...payload })) as Observable<void>;

    source$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.submitting.set(false);
          this.notification.dismiss();
        })
      )
      .subscribe({
        next: () => {
          this.notification.success(this.isEditMode() ? 'Sprint mis à jour avec succès.' : 'Sprint créé avec succès.');
          this.isOpen.set(false);
          this.destroyFlatpickr();
          if (this.isEditMode()) {
            this.updated.emit();
          } else {
            this.created.emit();
          }
        },
        error: () => {
          this.notification.error(this.isEditMode() ? 'Échec de la mise à jour du sprint.' : 'Échec de la création du sprint.');
        }
      });
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeModal();
    }
  }

  private initFlatpickr(sprint?: BacklogSprint): void {
    this.destroyFlatpickr();

    const baseConfig: flatpickr.Options.Options = {
      enableTime: true,
      dateFormat: 'Y-m-d H:i',
      time_24hr: true,
      locale: French,
      altInput: true,
      altFormat: 'd/m/Y H:i',
      disableMobile: true
    };

    if (this.startPickerRef?.nativeElement) {
      this.flatpickrStart = flatpickr(this.startPickerRef.nativeElement, {
        ...baseConfig,
        defaultDate: sprint?.startDate || undefined,
        onChange: (_selectedDates, dateStr) => {
          this.form.get('startDate')?.setValue(dateStr, { emitEvent: false });
        }
      });
    }

    if (this.endPickerRef?.nativeElement) {
      this.flatpickrEnd = flatpickr(this.endPickerRef.nativeElement, {
        ...baseConfig,
        defaultDate: sprint?.endDate || undefined,
        onChange: (_selectedDates, dateStr) => {
          this.form.get('endDate')?.setValue(dateStr, { emitEvent: false });
        }
      });
    }
  }

  private destroyFlatpickr(): void {
    this.flatpickrStart?.destroy();
    this.flatpickrEnd?.destroy();
    this.flatpickrStart = null;
    this.flatpickrEnd = null;
  }
}
