import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { LocalModelApiService, LocalModelError } from './local-model-api.service';

describe('LocalModelApiService (mock local runtimes)', () => {
  let api: LocalModelApiService;
  let fetchSpy: jasmine.Spy;
  const signal = () => new AbortController().signal;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
  const ollamaModels = () => json({ models: [{ name: 'gemma3:4b' }] });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    api = TestBed.inject(LocalModelApiService);
    fetchSpy = spyOn(window, 'fetch');
  });

  it('only discovers on demand and excludes cloud, remote and malformed Ollama entries', async () => {
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.and.resolveTo(json({ models: [
      { name: 'gemma3:4b' }, { name: 'gemma3:4b' }, { name: 'deepseek:671b-cloud' },
      { name: 'alias', remote_host: 'https://example.invalid' }, { name: 'remote', remote_model: 'cloud-model' },
      { name: '<unsafe>' }, { name: 'a'.repeat(201) }, {},
    ] }));
    expect(await api.discover('ollama', signal())).toEqual(['gemma3:4b']);
    const [url, options] = fetchSpy.calls.mostRecent().args;
    expect(url).toBe('http://127.0.0.1:11434/api/tags?ngsw-bypass=true');
    expect(options).toEqual(jasmine.objectContaining({
      method: 'GET', credentials: 'omit', redirect: 'error', mode: 'cors', cache: 'no-store', referrerPolicy: 'no-referrer',
    }));
    expect(new Headers(options.headers).has('Authorization')).toBeFalse();
    expect(new Headers(options.headers).has('Cookie')).toBeFalse();
  });

  it('sends one bounded Ollama question to loopback without LMS credentials or automatic retries', async () => {
    fetchSpy.and.resolveTo(ollamaModels());
    await api.discover('ollama', signal());
    fetchSpy.and.resolveTo(json({ message: { content: 'A local answer.' } }));
    expect(await api.ask('ollama', 'gemma3:4b', '  Explain buoyancy  ', signal())).toBe('A local answer.');
    const [url, options] = fetchSpy.calls.mostRecent().args;
    expect(url).toBe('http://127.0.0.1:11434/api/chat?ngsw-bypass=true');
    expect(JSON.parse(options.body)).toEqual({
      model: 'gemma3:4b', messages: [{ role: 'user', content: 'Explain buoyancy' }],
      stream: false, options: { num_predict: 256, num_ctx: 2048 }, keep_alive: 0,
    });
    expect(new Headers(options.headers).get('Content-Type')).toBe('application/json');
    expect(new Headers(options.headers).has('Authorization')).toBeFalse();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('uses only fixed LM Studio OpenAI-compatible endpoints and the selected discovered model', async () => {
    fetchSpy.and.resolveTo(json({ data: [{ id: 'local/model-GGUF' }] }));
    expect(await api.discover('lmstudio', signal())).toEqual(['local/model-GGUF']);
    expect(fetchSpy.calls.mostRecent().args[0]).toBe('http://127.0.0.1:1234/v1/models?ngsw-bypass=true');
    fetchSpy.and.resolveTo(json({ choices: [{ message: { content: 'LM Studio answer' } }] }));
    expect(await api.ask('lmstudio', 'local/model-GGUF', 'Question', signal())).toBe('LM Studio answer');
    const [url, options] = fetchSpy.calls.mostRecent().args;
    expect(url).toBe('http://127.0.0.1:1234/v1/chat/completions?ngsw-bypass=true');
    expect(JSON.parse(options.body)).toEqual({
      model: 'local/model-GGUF', messages: [{ role: 'user', content: 'Question' }], stream: false, max_tokens: 256,
    });
  });

  it('rejects undiscovered models and invalid questions without a request', async () => {
    await expectAsync(api.ask('ollama', 'unknown', 'Question', signal())).toBeRejectedWith(jasmine.any(LocalModelError));
    fetchSpy.and.resolveTo(ollamaModels());
    await api.discover('ollama', signal());
    await expectAsync(api.ask('ollama', 'gemma3:4b', ' ', signal())).toBeRejectedWith(jasmine.any(LocalModelError));
    await expectAsync(api.ask('ollama', 'gemma3:4b', 'q'.repeat(2001), signal())).toBeRejectedWith(jasmine.any(LocalModelError));
    await expectAsync(api.ask('lmstudio', 'gemma3:4b', 'Question', signal())).toBeRejectedWith(jasmine.any(LocalModelError));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('aborts the actual fetch on cancellation and never resends it', async () => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    fetchSpy.and.callFake((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      receivedSignal = options.signal!;
      receivedSignal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const request = api.discover('ollama', controller.signal);
    controller.abort();
    await expectAsync(request).toBeRejectedWith(jasmine.objectContaining({ code: 'cancelled' }));
    expect(receivedSignal!.aborted).toBeTrue();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('ends an unavailable discovery at its deadline without automatic retries', fakeAsync(() => {
    let error: LocalModelError | undefined;
    fetchSpy.and.callFake((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    void api.discover('ollama', signal()).catch(reason => { error = reason; });
    tick(8_000);
    flushMicrotasks();
    expect(error?.code).toBe('timeout');
    tick(90_000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  }));

  it('bounds bytes before parsing and cancels the response stream', async () => {
    let cancelled = false;
    fetchSpy.and.resolveTo(new Response(new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(262_145)); },
      cancel() { cancelled = true; },
    }), { headers: { 'Content-Type': 'application/json' } }));
    await expectAsync(api.discover('ollama', signal())).toBeRejectedWith(jasmine.objectContaining({ code: 'too_large' }));
    expect(cancelled).toBeTrue();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('decodes UTF-8 split across response chunks and rejects oversized answer text', async () => {
    fetchSpy.and.resolveTo(ollamaModels());
    await api.discover('ollama', signal());
    const bytes = new TextEncoder().encode(JSON.stringify({ message: { content: 'Học về lực nổi 🚢' } }));
    fetchSpy.and.resolveTo(new Response(new ReadableStream<Uint8Array>({ start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    } }), { headers: { 'Content-Type': 'application/json' } }));
    expect(await api.ask('ollama', 'gemma3:4b', 'Question', signal())).toBe('Học về lực nổi 🚢');
    fetchSpy.and.resolveTo(json({ message: { content: 'a'.repeat(20_001) } }));
    await expectAsync(api.ask('ollama', 'gemma3:4b', 'Question', signal()))
      .toBeRejectedWith(jasmine.objectContaining({ code: 'too_large' }));
  });

  it('does not expose raw local server errors or retry CORS/auth failures', async () => {
    fetchSpy.and.resolveTo(json({ error: 'private-local-path-or-token' }, 403));
    let failure: unknown;
    try { await api.discover('ollama', signal()); } catch (error) { failure = error; }
    expect(failure).toEqual(jasmine.objectContaining({ code: 'connection' }));
    expect(String(failure)).not.toContain('private-local');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not let a cancelled discovery publish models after a late response', async () => {
    const controller = new AbortController();
    let resolve!: (response: Response) => void;
    fetchSpy.and.returnValue(new Promise<Response>(done => { resolve = done; }));
    const request = api.discover('ollama', controller.signal);
    controller.abort();
    resolve(ollamaModels());
    await expectAsync(request).toBeRejectedWith(jasmine.objectContaining({ code: 'cancelled' }));
    await expectAsync(api.ask('ollama', 'gemma3:4b', 'Question', signal()))
      .toBeRejectedWith(jasmine.objectContaining({ code: 'invalid' }));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
