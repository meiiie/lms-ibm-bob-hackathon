import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { LocalModelApiService, LocalModelError, LocalModelProvider } from '../../../infrastructure/api/local-model-api.service';

@Component({
  selector: 'app-local-model-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="local-body" aria-label="Local study assistant" [attr.aria-busy]="busy()">
      <header><div class="capability-line"><strong>On this device · local model</strong><span>Experimental</span></div>
        <p>Study help without internet, when a downloaded model and its local server are running on this device.</p>
      </header>
      <div class="setup-block">
        <label for="local-runtime">Local server</label>
        <select id="local-runtime" [value]="provider()" (change)="changeProvider($event)">
          <option value="ollama">Ollama · port 11434</option><option value="lmstudio">LM Studio · port 1234</option>
        </select>
        <p class="hint">Choose the server already installed on this computer. On a phone, “this device” means the phone, not your laptop.</p>
        <button type="button" class="primary-button" (click)="check()" [disabled]="busy()">{{ operation() === 'check' ? 'Checking local server…' : 'Check connection' }}</button>
        @if (checked()) {
          <p role="status" class="connection-status">{{ models().length ? 'Local server reached. Choose a model below.' : 'Server reached, but no eligible local models were found. Download a model in your local server first.' }}</p>
        }
        @if (models().length) {
          <label for="local-model">Downloaded model</label>
          <select id="local-model" [value]="model()" (change)="changeModel($event)" [disabled]="busy()">
            @for (name of models(); track name) { <option [value]="name">{{ name }}</option> }
          </select>
        }
      </div>
      @if (error()) { <div class="error-block" role="alert"><strong>Request not completed</strong><p>{{ error() }}</p></div> }
      @if (notice()) { <p role="status" class="hint">{{ notice() }}</p> }
      <form (submit)="send($event)">
        <div class="question-label"><label for="local-question">Your study question</label><span>{{ question().length }} / 2,000</span></div>
        <textarea id="local-question" rows="4" maxlength="2000" [value]="question()" (input)="updateQuestion($event)"
          [disabled]="busy()" placeholder="Ask about a concept from your lesson…" aria-describedby="local-question-help"></textarea>
        <p id="local-question-help" class="hint">Only this question is sent to your local server. Nothing is sent automatically or forwarded to a cloud provider.</p>
        <p class="hint">Your draft stays in memory while this panel is open. Closing the panel clears it.</p>
        <div class="actions">
          @if (busy()) { <button type="button" class="secondary-button" (click)="cancel()">Cancel request</button> }
          <button type="submit" class="primary-button" [disabled]="!canSend()">{{ operation() === 'ask' ? 'Getting local answer…' : 'Send question' }}</button>
        </div>
      </form>
      @if (answer()) {
        <h2>Local answer</h2><div class="answer" role="region" aria-label="Local model answer" aria-live="polite" tabindex="0" data-testid="local-model-answer">{{ answer() }}</div>
        <p class="hint">Check important information against your course material. AI can make mistakes.</p>
      }
      <details><summary>Local setup and privacy</summary><p>Start Ollama or LM Studio on this device and download a model before going offline. Enable access for this LMS origin in the server’s CORS settings, and allow local network access if your browser asks. This preview does not support authenticated LM Studio servers. Keep your existing security settings; use Ollama instead if appropriate.</p>
        <p>This panel never installs models, starts services, or stores a conversation. Known Ollama cloud models are excluded. Your local server’s own settings still apply. Cancelling stops this browser request; the server may briefly continue generation.</p></details>
    </section>
  `,
  styles: [`
    :host { display:block; flex:1; min-height:0; min-width:0; overflow:auto; background:var(--c-surface,#fff); color:var(--c-text,#0a2a43); }
    *, *::before, *::after { box-sizing:border-box; }
    .local-body { padding:1.125rem; font:inherit; font-size:.875rem; line-height:1.55; }
    .capability-line { display:flex; justify-content:space-between; gap:.5rem; flex-wrap:wrap; font-size:.75rem; }
    .capability-line>span { border:1px solid var(--c-border,#dce3e9); border-radius:.25rem; padding:.125rem .375rem; color:var(--c-muted,#4b5565); font-size:.6875rem; }
    header p, .hint, details { color:var(--c-muted,#4b5565); }
    p { overflow-wrap:anywhere; }
    .setup-block { padding:1rem; border:1px solid var(--c-border,#dce3e9); border-radius:.75rem; margin:1rem 0; }
    label { display:block; font-size:.8125rem; font-weight:600; margin-bottom:.5rem; }
    select, textarea { width:100%; font:inherit; color:inherit; background:var(--c-surface,#fff); border:1px solid #a9b6c3; border-radius:.5rem; padding:.625rem; min-height:2.75rem; }
    select { text-overflow:ellipsis; }
    textarea { display:block; resize:vertical; min-height:7.5rem; line-height:1.5; }
    textarea::placeholder { color:var(--c-muted,#4b5565); }
    button { min-height:2.75rem; padding:.625rem .875rem; font:inherit; font-weight:600; cursor:pointer; border-radius:.5rem; }
    .primary-button { color:#fff; background:var(--c-primary,#1c5c86); border:1px solid transparent; }
    .primary-button:hover:not(:disabled) { background:#16496b; }
    .secondary-button { color:var(--c-primary,#1c5c86); background:var(--c-surface,#fff); border:1px solid var(--c-border,#dce3e9); }
    button:disabled { opacity:.55; cursor:default; }
    button:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible, .answer:focus-visible { outline:2px solid var(--c-text,#0a2a43); outline-offset:3px; }
    .hint, details { font-size:.75rem; }
    .connection-status { font-size:.8125rem; margin:1rem 0; }
    .question-label, .actions { display:flex; justify-content:space-between; align-items:baseline; gap:.5rem; }
    .question-label>span { color:var(--c-muted,#4b5565); font-size:.6875rem; white-space:nowrap; }
    .actions { justify-content:flex-end; flex-wrap:wrap; }
    h2 { font-size:.875rem; margin:1.5rem 0 .625rem; }
    .answer { white-space:pre-wrap; overflow-wrap:anywhere; padding:.875rem; border-radius:.625rem; background:var(--c-bg,#f8fafc); max-height:26rem; overflow:auto; line-height:1.7; }
    .error-block { border-left:3px solid #b42318; background:#fff5f4; color:#922017; padding:.75rem; border-radius:0 .5rem .5rem 0; margin:1rem 0; font-size:.8125rem; }
    .error-block p { margin:.25rem 0 0; }
    details { margin-top:1.25rem; padding-top:.875rem; border-top:1px solid var(--c-border,#dce3e9); }
    summary { cursor:pointer; min-height:2.75rem; }
    @media(max-width:380px) { .local-body { padding:1rem; } .setup-block { padding:.875rem; } .actions { flex-direction:column; align-items:stretch; } }
  `],
})
export class LocalModelPanelComponent implements OnDestroy {
  private readonly api = inject(LocalModelApiService);
  readonly provider = signal<LocalModelProvider>('ollama');
  readonly models = signal<string[]>([]);
  readonly model = signal('');
  readonly checked = signal(false);
  readonly operation = signal<'check' | 'ask' | null>(null);
  readonly busy = computed(() => this.operation() !== null);
  readonly question = signal('');
  readonly answer = signal('');
  readonly error = signal('');
  readonly notice = signal('');
  readonly canSend = computed(() => !this.busy() && this.checked() && this.models().includes(this.model()) && !!this.question().trim());
  private controller?: AbortController;
  private generation = 0;
  private destroyed = false;

  check(): void {
    if (this.destroyed || this.busy()) return;
    this.checked.set(false);
    this.models.set([]);
    this.model.set('');
    this.run('check', signal => this.api.discover(this.provider(), signal), models => {
      this.models.set(models);
      this.model.set(models[0] ?? '');
      this.checked.set(true);
    });
  }

  changeProvider(event: Event): void {
    const provider = (event.target as HTMLSelectElement).value;
    if (provider !== 'ollama' && provider !== 'lmstudio') return;
    this.cancel();
    this.provider.set(provider);
    this.models.set([]);
    this.model.set('');
    this.checked.set(false);
    this.answer.set('');
    this.error.set('');
    this.notice.set('');
  }

  changeModel(event: Event): void {
    if (this.busy()) return;
    const model = (event.target as HTMLSelectElement).value;
    if (this.models().includes(model)) { this.model.set(model); this.answer.set(''); }
  }

  updateQuestion(event: Event): void { this.question.set((event.target as HTMLTextAreaElement).value.slice(0, 2_000)); }

  send(event: Event): void {
    event.preventDefault();
    if (this.destroyed || !this.canSend() || this.question().trim().length > 2_000) return;
    this.answer.set('');
    this.run('ask', signal => this.api.ask(this.provider(), this.model(), this.question().trim(), signal), answer => {
      this.answer.set(answer);
      this.question.set('');
    });
  }

  cancel(): void {
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
    if (this.busy()) this.notice.set('Request cancelled. Nothing will be resent automatically.');
    this.operation.set(null);
  }

  ngOnDestroy(): void { this.destroyed = true; this.cancel(); this.question.set(''); this.answer.set(''); }

  private run<T>(operation: 'check' | 'ask', request: (signal: AbortSignal) => Promise<T>, accept: (value: T) => void): void {
    const generation = ++this.generation;
    this.controller = new AbortController();
    this.operation.set(operation);
    this.error.set('');
    this.notice.set('');
    void request(this.controller.signal).then(value => {
      if (generation !== this.generation || this.destroyed) return;
      accept(value);
    }).catch(error => {
      if (generation !== this.generation || this.destroyed) return;
      const code = error instanceof LocalModelError ? error.code : 'connection';
      this.error.set(code === 'timeout' ? 'The local server took too long. Check that the model fits your device and try again.'
        : code === 'too_large' ? 'The local server returned an answer that exceeds this preview’s limit. Try a shorter question.'
        : code === 'server' || code === 'invalid' ? 'The local server could not complete this request. Check its model and server settings, then try again.'
        : 'Cannot reach the local server. Start it on this device, allow this LMS origin in its CORS settings, and allow local network access in your browser. Nothing was sent to the cloud.');
    }).finally(() => {
      if (generation !== this.generation || this.destroyed) return;
      this.operation.set(null);
      this.controller = undefined;
    });
  }
}
