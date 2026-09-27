import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';

export type AppLanguage = 'vi' | 'en';

const STORAGE_KEY = 'lms_language';
const DEFAULT_LANG: AppLanguage = 'vi';
const SUPPORTED_LANGS: AppLanguage[] = ['vi', 'en'];

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly platformId = inject(PLATFORM_ID);

  /** Reactive signal for the current language — use in templates */
  readonly currentLang = signal<AppLanguage>(DEFAULT_LANG);

  constructor() {
    const saved = this.getSavedLanguage();
    this.applyLanguage(saved, false);
  }

  /** Switch language and persist to localStorage */
  setLanguage(lang: AppLanguage): void {
    if (!SUPPORTED_LANGS.includes(lang) || lang === this.currentLang()) return;
    this.applyLanguage(lang, true);
  }

  /** Toggle between vi and en */
  toggle(): void {
    this.setLanguage(this.currentLang() === 'vi' ? 'en' : 'vi');
  }

  private applyLanguage(lang: AppLanguage, persist: boolean): void {
    this.translate.use(lang);
    this.currentLang.set(lang);

    if (persist && isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        // localStorage may be unavailable (private mode, SSR)
      }
    }

    // Update HTML lang attribute for accessibility / SEO
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.lang = lang;
    }
  }

  private getSavedLanguage(): AppLanguage {
    if (!isPlatformBrowser(this.platformId)) return DEFAULT_LANG;
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as AppLanguage | null;
      return saved && SUPPORTED_LANGS.includes(saved) ? saved : DEFAULT_LANG;
    } catch {
      return DEFAULT_LANG;
    }
  }
}
