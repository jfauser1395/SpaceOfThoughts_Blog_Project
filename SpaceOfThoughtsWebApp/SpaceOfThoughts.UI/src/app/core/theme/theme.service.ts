import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';

// Themes supported by the application's CSS and Bootstrap theme selectors.
export type Theme = 'light' | 'dark';

// Persist a visitor's explicit selection between browser sessions.
export const THEME_STORAGE_KEY = 'space-of-thoughts-theme';

// Match the dark theme rendered in index.html to avoid a flash during startup and SSR.
const DEFAULT_THEME: Theme = 'dark';

// Keep the browser and installed PWA chrome consistent with the active page theme.
const THEME_COLOR: Record<Theme, string> = {
  light: '#f8f5f7',
  dark: '#17191d',
};

// Synchronize the reactive theme state with the DOM, Bootstrap, and browser storage.
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  // Inject DOCUMENT and PLATFORM_ID so the service also remains safe during SSR.
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly themeState = signal<Theme>(DEFAULT_THEME);

  // Expose reactive read-only state for components without allowing direct mutation.
  readonly theme = this.themeState.asReadonly();
  readonly isDarkTheme = computed(() => this.themeState() === 'dark');

  // Restore a valid saved preference once browser-only APIs are available.
  initialize(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.applyTheme(this.resolvePreferredTheme(), false);
  }

  // Toggle and persist the visitor's explicit theme choice.
  toggleTheme(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const nextTheme: Theme = this.themeState() === 'dark' ? 'light' : 'dark';
    this.applyTheme(nextTheme, true);
  }

  // Prefer a valid stored choice and otherwise retain the application's dark default.
  private resolvePreferredTheme(): Theme {
    const savedTheme = this.readSavedTheme();

    if (savedTheme) {
      return savedTheme;
    }

    return DEFAULT_THEME;
  }

  // Treat unavailable, blocked, or malformed local storage values as no preference.
  private readSavedTheme(): Theme | null {
    try {
      return this.toTheme(
        this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY),
      );
    } catch {
      return null;
    }
  }

  // Update every theme consumer together and optionally save the new selection.
  private applyTheme(theme: Theme, persist: boolean): void {
    const documentElement = this.document.documentElement;

    // The app uses data-theme, while Bootstrap components use data-bs-theme.
    documentElement.setAttribute('data-theme', theme);
    documentElement.setAttribute('data-bs-theme', theme);

    // Tell the browser how to render native controls such as inputs and scrollbars.
    documentElement.style.colorScheme = theme;
    this.themeState.set(theme);
    this.updateThemeColor(theme);

    if (!persist) {
      return;
    }

    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The selected theme still applies for this page when storage is unavailable.
    }
  }

  // Update browser/PWA chrome and create the meta element if a host omitted it.
  private updateThemeColor(theme: Theme): void {
    let themeColor = this.document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );

    if (!themeColor) {
      themeColor = this.document.createElement('meta');
      themeColor.name = 'theme-color';
      this.document.head.appendChild(themeColor);
    }

    themeColor.content = THEME_COLOR[theme];
  }

  // Narrow untrusted storage input to one of the supported theme values.
  private toTheme(value: string | null | undefined): Theme | null {
    return value === 'light' || value === 'dark' ? value : null;
  }
}
