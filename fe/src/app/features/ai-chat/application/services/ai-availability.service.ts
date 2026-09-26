import { DestroyRef, Injectable, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ChatApiClient } from '../../infrastructure/api/chat-api.client';
import { isAiHealthReady } from './ai-health.util';
import { ChatgptApiService } from '../../infrastructure/api/chatgpt-api.service';
import { NetworkStatusService } from '../../../../core/services/network-status.service';

type AiAvailabilityStatus = 'checking' | 'available' | 'unavailable';

@Injectable({ providedIn: 'root' })
export class AiAvailabilityService {
  private readonly apiClient = inject(ChatApiClient);
  private readonly chatgpt = inject(ChatgptApiService);
  private readonly network = inject(NetworkStatusService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _status = signal<AiAvailabilityStatus>('checking');
  private readonly chatgptResolved = signal(false);
  readonly chatgptEnabled = signal(false);
  readonly wiiiAvailable = computed(() => this._status() === 'available');
  // Browser capability only. A local server is checked after the learner asks.
  readonly localSupported = signal(this.isBrowser
    && typeof globalThis.fetch === 'function').asReadonly();

  readonly isAvailable = computed(() => this.wiiiAvailable() || this.chatgptEnabled());
  readonly canOpenAssistant = computed(() => this.isAvailable() || this.localSupported());
  readonly status = computed<AiAvailabilityStatus>(() => this.isAvailable() ? 'available'
    : this._status() === 'checking' || !this.chatgptResolved() ? 'checking' : 'unavailable');
  readonly hasResolved = computed(() => this.status() !== 'checking');
  private generation = 0;
  private refreshDeferred = false;

  constructor() {
    const browserWindow = this.isBrowser && typeof window !== 'undefined' ? window : null;
    const recoverSkippedDiscovery = () => {
      if (this.refreshDeferred) this.refresh();
    };
    browserWindow?.addEventListener('online', recoverSkippedDiscovery);
    this.destroyRef.onDestroy(() => {
      browserWindow?.removeEventListener('online', recoverSkippedDiscovery);
      this.generation++;
    });
    this.refresh();
    let wasOnline = this.network.online();
    effect(() => {
      const online = this.network.online();
      if (online && !wasOnline && this.refreshDeferred) untracked(() => this.refresh());
      if (!online && wasOnline) {
        this.generation++;
        this.refreshDeferred = true;
      }
      wasOnline = online;
    });
  }

  refresh(): void {
    const generation = ++this.generation;
    if (this.network.isEffectivelyOffline()) {
      this.refreshDeferred = true;
      this._status.set('unavailable');
      this.chatgptResolved.set(true);
      return;
    }
    this.refreshDeferred = false;
    this.apiClient.checkHealth().subscribe({
      next: (health) => {
        if (generation !== this.generation) return;
        const isAvailable = isAiHealthReady(health);
        this._status.set(isAvailable ? 'available' : 'unavailable');
      },
      error: () => {
        if (generation !== this.generation) return;
        this._status.set('unavailable');
      }
    });
    this.chatgpt.status().subscribe({
      next: (state) => {
        if (generation !== this.generation) return;
        this.chatgptEnabled.set(state.enabled);
        this.chatgptResolved.set(true);
      },
      error: () => {
        if (generation !== this.generation) return;
        this.chatgptEnabled.set(false);
        this.chatgptResolved.set(true);
      },
    });
  }
}
