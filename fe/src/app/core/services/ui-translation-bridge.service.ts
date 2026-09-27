import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, Injector, NgZone, PLATFORM_ID, effect, inject } from '@angular/core';
import { TranslationObject } from '@ngx-translate/core';
import { firstValueFrom, forkJoin } from 'rxjs';
import { AppLanguage, LanguageService } from './language.service';

const TRANSLATED_ATTRIBUTES = ['aria-label', 'placeholder', 'title'] as const;
const EXCLUDED_SELECTOR = [
  'script',
  'style',
  'textarea',
  '[contenteditable="true"]',
  '[translate="no"]',
  '.notranslate',
  '[data-i18n-user-content]',
  '.ProseMirror',
  '.lesson-prose',
  'app-text-block',
  'app-message-bubble',
  'app-chat-message',
].join(',');

interface TextTranslation {
  original: string;
  translated: string;
}

interface AttributeTranslation {
  original: string;
  translated: string;
}

type LegacyTranslationCatalog = Record<string, string>;

interface TranslationPattern {
  expression: RegExp;
  target: string;
}

/**
 * Compatibility layer for legacy templates that still contain Vietnamese UI
 * copy. New code should continue to use the ngx-translate pipe/directive.
 */
@Injectable({ providedIn: 'root' })
export class UiTranslationBridgeService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly http = inject(HttpClient);
  private readonly language = inject(LanguageService);
  private readonly ngZone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly textTranslations = new WeakMap<Text, TextTranslation>();
  private readonly translatedTextNodes = new Set<Text>();
  private readonly attributeTranslations = new WeakMap<Element, Map<string, AttributeTranslation>>();
  private readonly translatedElements = new Set<Element>();

  private catalogPromise?: Promise<Map<string, string> | null>;
  private catalogFailed = false;
  private translationPatterns: TranslationPattern[] = [];
  private observer?: MutationObserver;
  private activeLanguage: AppLanguage = 'vi';
  private initialized = false;

  initialize(): void {
    if (this.initialized || !isPlatformBrowser(this.platformId)) return;
    this.initialized = true;
    const retryCatalog = () => {
      if (this.activeLanguage === 'en' && this.catalogFailed) {
        this.catalogPromise = undefined;
        this.catalogFailed = false;
        void this.translateDocument();
      }
    };
    this.document.defaultView?.addEventListener('online', retryCatalog);
    this.destroyRef.onDestroy(() => {
      this.observer?.disconnect();
      this.document.defaultView?.removeEventListener('online', retryCatalog);
    });

    this.ngZone.runOutsideAngular(() => {
      this.observer = new MutationObserver((mutations) => this.handleMutations(mutations));
      this.observer.observe(this.document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...TRANSLATED_ATTRIBUTES],
      });
    });

    effect(
      () => {
        const lang = this.language.currentLang();
        this.activeLanguage = lang;
        if (lang === 'en') {
          if (this.catalogFailed) {
            this.catalogPromise = undefined;
            this.catalogFailed = false;
          }
          void this.translateDocument();
        } else {
          this.restoreVietnamese();
        }
      },
      { injector: this.injector },
    );
  }

  private async translateDocument(): Promise<void> {
    const catalog = await this.getCatalog();
    if (!catalog || this.activeLanguage !== 'en') return;
    this.translateSubtree(this.document.documentElement, catalog);
  }

  private async handleMutations(mutations: MutationRecord[]): Promise<void> {
    if (this.activeLanguage !== 'en') return;
    const catalog = await this.getCatalog();
    if (!catalog || this.activeLanguage !== 'en') return;

    for (const mutation of mutations) {
      if (mutation.type === 'characterData' && mutation.target instanceof Text) {
        this.translateTextNode(mutation.target, catalog);
        continue;
      }

      if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        this.translateAttributes(mutation.target, catalog);
        continue;
      }

      for (const node of Array.from(mutation.addedNodes)) {
        this.translateSubtree(node, catalog);
      }
    }
  }

  private translateSubtree(root: Node, catalog: Map<string, string>): void {
    if (root instanceof Text) {
      this.translateTextNode(root, catalog);
      return;
    }
    if (!(root instanceof Element) || this.isExcluded(root)) return;

    this.translateAttributes(root, catalog);
    const walker = this.document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node instanceof Element) {
        if (this.isExcluded(node)) {
          node = this.nextAfterSubtree(walker, node);
          continue;
        }
        this.translateAttributes(node, catalog);
      } else if (node instanceof Text) {
        this.translateTextNode(node, catalog);
      }
      node = walker.nextNode();
    }
  }

  private nextAfterSubtree(walker: TreeWalker, excluded: Element): Node | null {
    let current: Node | null = excluded;
    while (current && current !== walker.root) {
      const sibling = walker.nextSibling();
      if (sibling) return sibling;
      current = walker.parentNode();
    }
    return null;
  }

  private translateTextNode(node: Text, catalog: Map<string, string>): void {
    const parent = node.parentElement;
    if (!parent || this.isExcluded(parent)) return;

    const previous = this.textTranslations.get(node);
    if (previous?.translated === node.data) return;

    const translated = this.lookup(node.data, catalog);
    if (!translated || translated === node.data) {
      if (previous && node.data !== previous.translated) {
        this.textTranslations.delete(node);
        this.translatedTextNodes.delete(node);
      }
      return;
    }

    this.textTranslations.set(node, { original: node.data, translated });
    this.translatedTextNodes.add(node);
    node.data = translated;
  }

  private translateAttributes(element: Element, catalog: Map<string, string>): void {
    if (this.isExcluded(element)) return;

    for (const attribute of TRANSLATED_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (!value) continue;

      const previous = this.attributeTranslations.get(element)?.get(attribute);
      if (previous?.translated === value) continue;

      const translated = this.lookup(value, catalog);
      if (!translated || translated === value) continue;

      let entries = this.attributeTranslations.get(element);
      if (!entries) {
        entries = new Map();
        this.attributeTranslations.set(element, entries);
      }
      entries.set(attribute, { original: value, translated });
      this.translatedElements.add(element);
      element.setAttribute(attribute, translated);
    }
  }

  private lookup(value: string, catalog: Map<string, string>): string | undefined {
    const leading = value.match(/^\s*/)?.[0] ?? '';
    const trailing = value.match(/\s*$/)?.[0] ?? '';
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) return undefined;
    const translated = catalog.get(normalized);
    if (translated) return `${leading}${translated}${trailing}`;

    for (const pattern of this.translationPatterns) {
      const match = pattern.expression.exec(normalized);
      if (!match) continue;
      const patternTranslation = pattern.target.replace(/__NEKO_(\d+)__/g, (_, index: string) => {
        return match[Number(index) + 1] ?? '';
      });
      return `${leading}${patternTranslation}${trailing}`;
    }
    return undefined;
  }

  private restoreVietnamese(): void {
    for (const node of this.translatedTextNodes) {
      const translation = this.textTranslations.get(node);
      if (translation && node.data === translation.translated) node.data = translation.original;
    }
    this.translatedTextNodes.clear();

    for (const element of this.translatedElements) {
      const translations = this.attributeTranslations.get(element);
      if (!translations) continue;
      for (const [attribute, translation] of translations) {
        if (element.getAttribute(attribute) === translation.translated) {
          element.setAttribute(attribute, translation.original);
        }
      }
    }
    this.translatedElements.clear();
  }

  private getCatalog(): Promise<Map<string, string> | null> {
    this.catalogPromise ??= firstValueFrom(
      forkJoin({
        vi: this.http.get<TranslationObject>('/locales/vi.json'),
        en: this.http.get<TranslationObject>('/locales/en.json'),
        legacy: this.http.get<LegacyTranslationCatalog>('/locales/legacy-ui.en.json'),
      }),
    ).then(({ vi, en, legacy }) => this.buildCatalog(vi, en, legacy)).catch(() => {
      // Keep the original UI during an outage; retry on reconnect or language switch,
      // not on every DOM mutation while the network is unavailable.
      this.catalogFailed = true;
      return null;
    });
    return this.catalogPromise;
  }

  private buildCatalog(
    vi: TranslationObject,
    en: TranslationObject,
    legacy: LegacyTranslationCatalog,
  ): Map<string, string> {
    const viValues = this.flatten(vi);
    const enValues = this.flatten(en);
    const catalog = new Map<string, string>();

    for (const [key, source] of viValues) {
      const target = enValues.get(key);
      if (!target || source === target) continue;
      catalog.set(source.trim().replace(/\s+/g, ' '), target.trim().replace(/\s+/g, ' '));
    }
    for (const [source, target] of Object.entries(legacy)) {
      if (!source || !target || source === target) continue;
      const normalizedSource = source.trim().replace(/\s+/g, ' ');
      const normalizedTarget = target.trim().replace(/\s+/g, ' ');
      if (normalizedSource.includes('__NEKO_')) {
        const pattern = this.compilePattern(normalizedSource, normalizedTarget);
        if (pattern) this.translationPatterns.push(pattern);
      } else {
        catalog.set(normalizedSource, normalizedTarget);
      }
    }
    this.translationPatterns.sort((left, right) => right.expression.source.length - left.expression.source.length);
    return catalog;
  }

  private compilePattern(source: string, target: string): TranslationPattern | undefined {
    const token = /__NEKO_(\d+)__/g;
    let position = 0;
    let expression = '^';
    let match: RegExpExecArray | null;
    let tokenCount = 0;

    while ((match = token.exec(source))) {
      expression += this.escapePatternText(source.slice(position, match.index));
      expression += '(.*?)';
      position = match.index + match[0].length;
      tokenCount += 1;
    }
    if (!tokenCount) return undefined;
    expression += `${this.escapePatternText(source.slice(position))}$`;
    return { expression: new RegExp(expression, 'u'), target };
  }

  private escapePatternText(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ +/g, '\\s+');
  }

  private flatten(value: TranslationObject, prefix = '', result = new Map<string, string>()): Map<string, string> {
    for (const [key, entry] of Object.entries(value)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof entry === 'string') {
        result.set(fullKey, entry);
      } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        this.flatten(entry as TranslationObject, fullKey, result);
      }
    }
    return result;
  }

  private isExcluded(element: Element): boolean {
    return element.matches(EXCLUDED_SELECTOR) || !!element.closest(EXCLUDED_SELECTOR);
  }
}
