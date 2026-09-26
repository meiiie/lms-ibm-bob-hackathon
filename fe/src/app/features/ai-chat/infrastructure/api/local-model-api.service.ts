import { Injectable } from '@angular/core';

export type LocalModelProvider = 'ollama' | 'lmstudio';
export type LocalModelErrorCode = 'connection' | 'timeout' | 'cancelled' | 'invalid' | 'too_large' | 'server';

export class LocalModelError extends Error {
  constructor(readonly code: LocalModelErrorCode) { super(code); }
}

const ENDPOINTS = {
  ollama: { base: 'http://127.0.0.1:11434', models: '/api/tags', chat: '/api/chat' },
  lmstudio: { base: 'http://127.0.0.1:1234', models: '/v1/models', chat: '/v1/chat/completions' },
} as const;
const MAX_BYTES = 262_144;
const validId = (value: unknown): value is string => typeof value === 'string'
  && value.length > 0 && value.length <= 200 && /^[a-zA-Z0-9_.:/@+\-]+$/.test(value);
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object'
  ? value as Record<string, unknown> : {};

@Injectable({ providedIn: 'root' })
export class LocalModelApiService {
  private readonly discovered = new Map<LocalModelProvider, Set<string>>();

  async discover(provider: LocalModelProvider, signal: AbortSignal): Promise<string[]> {
    this.discovered.delete(provider);
    const payload = object(await this.request(provider, 'models', undefined, signal, 8_000));
    const entries = provider === 'ollama' ? payload['models'] : payload['data'];
    if (!Array.isArray(entries)) throw new LocalModelError('invalid');
    const names = entries.slice(0, 100).flatMap(entry => {
      const model = object(entry);
      const name = provider === 'ollama' ? model['name'] : model['id'];
      if (!validId(name)) return [];
      if (provider === 'ollama' && (/cloud/i.test(name) || model['remote_host'] || model['remote_model'])) return [];
      return [name];
    });
    const unique = [...new Set(names)];
    if (signal.aborted) throw new LocalModelError('cancelled');
    this.discovered.set(provider, new Set(unique));
    return unique;
  }

  async ask(provider: LocalModelProvider, model: string, question: string, signal: AbortSignal): Promise<string> {
    const text = question.trim();
    if (!text || text.length > 2_000 || !this.discovered.get(provider)?.has(model)) {
      throw new LocalModelError('invalid');
    }
    const body = {
      model, messages: [{ role: 'user', content: text }], stream: false,
      ...(provider === 'ollama'
        ? { options: { num_predict: 256, num_ctx: 2_048 }, keep_alive: 0 }
        : { max_tokens: 256 }),
    };
    const payload = object(await this.request(provider, 'chat', body, signal, 90_000));
    const choices = payload['choices'];
    const answer = provider === 'ollama' ? object(payload['message'])['content']
      : Array.isArray(choices) ? object(object(choices[0])['message'])['content'] : undefined;
    if (typeof answer !== 'string' || !answer.trim()) throw new LocalModelError('invalid');
    if (answer.length > 20_000) throw new LocalModelError('too_large');
    return answer;
  }

  private async request(provider: LocalModelProvider, action: 'models' | 'chat', body: unknown,
    signal: AbortSignal, timeoutMs: number): Promise<unknown> {
    if (signal.aborted) throw new LocalModelError('cancelled');
    const endpoint = ENDPOINTS[provider];
    if (!endpoint) throw new LocalModelError('invalid');
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    signal.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      // Isolated fetch intentionally bypasses LMS JWT, offline queue, retries and auth refresh.
      const response = await fetch(`${endpoint.base}${endpoint[action]}?ngsw-bypass=true`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? { Accept: 'application/json' }
          : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        credentials: 'omit', redirect: 'error', mode: 'cors', cache: 'no-store',
        referrerPolicy: 'no-referrer', signal: controller.signal,
      });
      if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) {
        await response.body?.cancel();
        throw new LocalModelError(response.status === 403 ? 'connection' : 'server');
      }
      if (!response.body) throw new LocalModelError('invalid');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let bytes = 0;
      let text = '';
      let complete = false;
      try {
        while (true) {
          const chunk = await reader.read();
          if (controller.signal.aborted) throw new LocalModelError('cancelled');
          if (chunk.done) { complete = true; break; }
          bytes += chunk.value.byteLength;
          if (bytes > MAX_BYTES) throw new LocalModelError('too_large');
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
        return JSON.parse(text);
      } finally {
        if (!complete) await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    } catch (error) {
      if (timedOut) throw new LocalModelError('timeout');
      if (signal.aborted) throw new LocalModelError('cancelled');
      if (error instanceof LocalModelError) throw error;
      if (error instanceof SyntaxError) throw new LocalModelError('invalid');
      throw new LocalModelError('connection');
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
    }
  }
}
