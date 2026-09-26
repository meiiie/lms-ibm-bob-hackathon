import { Injectable, computed, inject, signal } from '@angular/core';
import { ChatApiClient } from '../../infrastructure/api/chat-api.client';
import { isAiHealthReady } from './ai-health.util';
import { ChatgptApiService } from '../../infrastructure/api/chatgpt-api.service';

type AiAvailabilityStatus = 'checking' | 'available' | 'unavailable';

@Injectable({ providedIn: 'root' })
export class AiAvailabilityService {
  private readonly apiClient = inject(ChatApiClient);
  private readonly chatgpt = inject(ChatgptApiService);

  private readonly _status = signal<AiAvailabilityStatus>('checking');
  private readonly chatgptResolved = signal(false);
  readonly chatgptEnabled = signal(false);
  readonly wiiiAvailable = computed(() => this._status() === 'available');

  readonly isAvailable = computed(() => this.wiiiAvailable() || this.chatgptEnabled());
  readonly status = computed<AiAvailabilityStatus>(() => this.isAvailable() ? 'available'
    : this._status() === 'checking' || !this.chatgptResolved() ? 'checking' : 'unavailable');
  readonly hasResolved = computed(() => this.status() !== 'checking');
  private generation = 0;

  constructor() {
    this.refresh();
  }

  refresh(): void {
    const generation = ++this.generation;
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
