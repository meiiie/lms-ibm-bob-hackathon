import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
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
  let host: HTMLDivElement;
  let offline = false;
  let legacyOffline = false;
  let requests = 0;

  beforeEach(() => {
    currentLang.set('vi');
    offline = false;
    legacyOffline = false;
    requests = 0;
    TestBed.configureTestingModule({
      providers: [
        UiTranslationBridgeService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: LanguageService, useValue: { currentLang } },
        {
          provide: HttpClient,
          useValue: {
            get: (url: string) => {
              requests++;
              if (offline) return throwError(() => new Error('Network unavailable'));
              if (url.endsWith('/vi.json')) return of(translations.vi);
              if (url.endsWith('/en.json')) return of(translations.en);
              if (legacyOffline) return throwError(() => new Error('Legacy catalog unavailable'));
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
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
  });

  it('keeps original UI on a catalog outage and retries once after reconnect', async () => {
    offline = true;
    host.innerHTML = '<button>Lưu</button>';
    TestBed.inject(UiTranslationBridgeService).initialize();
    currentLang.set('en');
    await settle();
    expect(host.querySelector('button')?.textContent).toBe('Lưu');
    const failedRequests = requests;
    host.appendChild(document.createElement('p'));
    await settle();
    expect(requests).toBe(failedRequests);
    offline = false;
    window.dispatchEvent(new Event('online'));
    await settle();
    expect(host.querySelector('button')?.textContent).toBe('Save');
    expect(requests).toBe(failedRequests + 3);
  });

  it('recovers when only the legacy catalog failed', async () => {
    legacyOffline = true;
    host.innerHTML = '<p>3 khóa đang học</p>';
    TestBed.inject(UiTranslationBridgeService).initialize();
    currentLang.set('en');
    await settle();
    expect(host.querySelector('p')?.textContent).toBe('3 khóa đang học');
    legacyOffline = false;
    window.dispatchEvent(new Event('online'));
    await settle();
    expect(host.querySelector('p')?.textContent).toBe('3 active courses');
  });

  it('translates legacy text and UI attributes, then restores Vietnamese', async () => {
    host.innerHTML = `
      <main>
        <button title="Đóng"> Lưu </button>
        <input placeholder="Tìm kiếm" value="Nội dung học viên">
      </main>
    `;
    TestBed.inject(UiTranslationBridgeService).initialize();

    currentLang.set('en');
    await settle();

    expect(host.querySelector('button')?.textContent).toBe(' Save ');
    expect(host.querySelector('button')?.getAttribute('title')).toBe('Close');
    expect(host.querySelector('input')?.getAttribute('placeholder')).toBe('Search');
    expect((host.querySelector('input') as HTMLInputElement).value).toBe('Nội dung học viên');

    currentLang.set('vi');
    await settle();

    expect(host.querySelector('button')?.textContent).toBe(' Lưu ');
    expect(host.querySelector('button')?.getAttribute('title')).toBe('Đóng');
  });

  it('translates content added after the language switch and skips user content', async () => {
    TestBed.inject(UiTranslationBridgeService).initialize();
    currentLang.set('en');
    await settle();

    const toast = document.createElement('p');
    toast.textContent = 'Thông báo mới';
    host.appendChild(toast);
    const count = document.createElement('p');
    count.textContent = '3 khóa đang học';
    host.appendChild(count);
    const userContent = document.createElement('p');
    userContent.dataset['i18nUserContent'] = '';
    userContent.textContent = 'Thông báo mới';
    host.appendChild(userContent);
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
