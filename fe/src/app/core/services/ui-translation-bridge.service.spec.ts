import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LanguageService } from './language.service';
import { UiTranslationBridgeService } from './ui-translation-bridge.service';

describe('UiTranslationBridgeService', () => {
  const currentLang = signal<'vi' | 'en'>('vi');
  const translations = {
    vi: {
      common: { save: 'Lưu', search: 'Tìm kiếm', close: 'Đóng' },
      legacyUi: { dynamic: 'Thông báo mới' },
    },
    en: {
      common: { save: 'Save', search: 'Search', close: 'Close' },
      legacyUi: { dynamic: 'New notification' },
    },
  };

  let document: Document;

  beforeEach(() => {
    currentLang.set('vi');
    TestBed.configureTestingModule({
      providers: [
        UiTranslationBridgeService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: LanguageService, useValue: { currentLang } },
        {
          provide: HttpClient,
          useValue: {
            get: (url: string) => {
              if (url.endsWith('/vi.json')) return of(translations.vi);
              if (url.endsWith('/en.json')) return of(translations.en);
              return of({
                'Thông báo mới': 'New notification',
                '__NEKO_0__ khóa đang học': '__NEKO_0__ active courses',
              });
            },
          },
        },
      ],
    });
    document = TestBed.inject(DOCUMENT);
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('translates legacy text and UI attributes, then restores Vietnamese', async () => {
    document.body.innerHTML = `
      <main>
        <button title="Đóng"> Lưu </button>
        <input placeholder="Tìm kiếm" value="Nội dung học viên">
      </main>
    `;
    TestBed.inject(UiTranslationBridgeService).initialize();

    currentLang.set('en');
    await settle();

    expect(document.querySelector('button')?.textContent).toBe(' Save ');
    expect(document.querySelector('button')?.getAttribute('title')).toBe('Close');
    expect(document.querySelector('input')?.getAttribute('placeholder')).toBe('Search');
    expect((document.querySelector('input') as HTMLInputElement).value).toBe('Nội dung học viên');

    currentLang.set('vi');
    await settle();

    expect(document.querySelector('button')?.textContent).toBe(' Lưu ');
    expect(document.querySelector('button')?.getAttribute('title')).toBe('Đóng');
  });

  it('translates content added after the language switch and skips user content', async () => {
    TestBed.inject(UiTranslationBridgeService).initialize();
    currentLang.set('en');
    await settle();

    const toast = document.createElement('p');
    toast.textContent = 'Thông báo mới';
    document.body.appendChild(toast);
    const count = document.createElement('p');
    count.textContent = '3 khóa đang học';
    document.body.appendChild(count);
    const userContent = document.createElement('p');
    userContent.dataset['i18nUserContent'] = '';
    userContent.textContent = 'Thông báo mới';
    document.body.appendChild(userContent);
    await settle();

    expect(toast.textContent).toBe('New notification');
    expect(count.textContent).toBe('3 active courses');
    expect(userContent.textContent).toBe('Thông báo mới');
  });
});

async function settle(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}
