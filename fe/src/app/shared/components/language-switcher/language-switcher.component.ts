import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LanguageService, AppLanguage } from '../../../core/services/language.service';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-language-switcher',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lang-switcher" [attr.aria-label]="'lang.switch' | translate">
      <button
        type="button"
        class="lang-btn"
        [class.lang-btn--active]="langService.currentLang() === 'vi'"
        [attr.aria-pressed]="langService.currentLang() === 'vi'"
        (click)="setLang('vi')"
        title="{{ 'lang.vi' | translate }}"
      >VI</button>
      <span class="lang-sep" aria-hidden="true">/</span>
      <button
        type="button"
        class="lang-btn"
        [class.lang-btn--active]="langService.currentLang() === 'en'"
        [attr.aria-pressed]="langService.currentLang() === 'en'"
        (click)="setLang('en')"
        title="{{ 'lang.en' | translate }}"
      >EN</button>
    </div>
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; }

    .lang-switcher {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 6px;
      padding: 2px 4px;
    }

    /* Dark background variant (used in top maritime bar) */
    :host(.on-dark) .lang-switcher {
      background: rgba(255,255,255,0.08);
      border-color: rgba(255,255,255,0.2);
    }

    /* Light background variant (used in main header) */
    :host(.on-light) .lang-switcher {
      background: rgba(0,86,210,0.05);
      border-color: rgba(0,86,210,0.15);
    }

    .lang-btn {
      min-height: 1.75rem;
      min-width: 1.75rem;
      padding: 0 6px;
      font: inherit;
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      opacity: 0.6;
      transition: opacity 120ms, background 120ms;
      line-height: 1;
    }

    .lang-btn:hover:not(.lang-btn--active) {
      opacity: 0.85;
      background: rgba(255,255,255,0.1);
    }

    :host(.on-light) .lang-btn:hover:not(.lang-btn--active) {
      background: rgba(0,86,210,0.08);
    }

    .lang-btn--active {
      opacity: 1;
      background: rgba(255,255,255,0.18);
    }

    :host(.on-light) .lang-btn--active {
      background: rgba(0,86,210,0.12);
      color: #0056D2;
    }

    .lang-btn:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }

    .lang-sep {
      font-size: 0.6875rem;
      opacity: 0.35;
      user-select: none;
      line-height: 1;
    }
  `]
})
export class LanguageSwitcherComponent {
  readonly langService = inject(LanguageService);

  setLang(lang: AppLanguage): void {
    this.langService.setLanguage(lang);
  }
}
