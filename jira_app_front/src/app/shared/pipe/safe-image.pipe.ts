import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Inline SVG data URI for a generic anonymous user avatar.
 * Used as ultimate fallback when the image URL is missing or returns 404.
 */
const DEFAULT_AVATAR_DATA_URI = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='50' fill='%23e2e8f0'/%3E%3Ctext x='50' y='58' text-anchor='middle' font-size='38' fill='%2394a3b8' font-family='Arial'%3E👤%3C/text%3E%3C/svg%3E`;

/**
 * SafeImagePipe
 *
 * Corrects image URLs:
 * - If URL starts with 'http' or 'data:' → returns as-is (already absolute)
 * - If URL is null/empty/undefined → returns inline SVG data URI
 * - Otherwise → prepends the backend base URL
 *
 * Usage: <img [src]="avatarUrl | safeImage" alt="..." />
 */
@Pipe({
  name: 'safeImage',
  standalone: true
})
export class SafeImagePipe implements PipeTransform {
  private readonly BACKEND_BASE = environment.baseUrl;

  transform(value: string | null | undefined): string {
    if (!value || value.trim() === '') {
      return DEFAULT_AVATAR_DATA_URI;
    }

    const trimmed = value.trim();

    // Already an absolute URL or data URI
    if (trimmed.startsWith('http') || trimmed.startsWith('data:')) {
      return trimmed;
    }

    // Relative path on the backend server
    if (trimmed.startsWith('/')) {
      return `${this.BACKEND_BASE}${trimmed}`;
    }

    // Relative path without leading slash
    return `${this.BACKEND_BASE}/${trimmed}`;
  }
}

