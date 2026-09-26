import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, signal, viewChild, ElementRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subscription } from 'rxjs';
import { NetworkStatusService } from '../../../../../core/services/network-status.service';
import { ChatgptApiService, ChatgptStatus } from '../../../infrastructure/api/chatgpt-api.service';

@Component({
  selector: 'app-chatgpt-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="assistant-body" aria-label="ChatGPT study assistant" [attr.aria-busy]="busy()">
      <header class="assistant-intro">
        <div class="capability-line">
          <span class="cloud-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M7 18a5 5 0 0 1-.6-9.96A6 6 0 0 1 18 7a5.5 5.5 0 0 1 0 11H7Z" /></svg>Cloud · online only</span>
          <span class="experimental-label">Experimental</span>
        </div>
        <p class="intro-copy">Explain concepts, practise questions, and plan your revision.</p>
        <p class="offline-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.5c-2-1.5-5-2-9-1v14c4-1 7-.5 9 1 2-1.5 5-2 9-1v-14c-4-1-7-.5-9 1Zm0 0v14" /></svg>Downloaded lessons work offline.</p>
      </header>

      @if (offline()) {
        <div class="state-block" role="status">
          <h2>You’re offline</h2>
          <p>ChatGPT needs an internet connection. You can keep learning with downloaded lessons and draft a question below.</p>
        </div>
      } @else if (needsResume()) {
        <div class="state-block" role="status">
          <h2>Resume your connection</h2>
          <p>Connection interrupted. Nothing will be resent automatically.</p>
          <button class="primary-button" (click)="resume()" [disabled]="busy()">Resume connection</button>
        </div>
      } @else if (connection()?.enabled === false) {
        <div class="state-block" role="status">
          <h2>ChatGPT is not enabled</h2>
          <p>Your LMS administrator has not enabled this optional connection. Your lessons remain available.</p>
        </div>
      } @else if (!connection()) {
        <div class="state-block" role="status">
          <h2>{{ busy() ? 'Checking connection…' : 'Connection unavailable' }}</h2>
          @if (busy()) {
            <div class="loading-lines" aria-hidden="true"><span></span><span></span></div>
          } @else {
            <p>Unable to check the ChatGPT connection. You can try again when you’re ready.</p>
            <button class="primary-button" (click)="resume()">Retry connection check</button>
          }
        </div>
      } @else if (connection()?.status === 'pending') {
        <div class="state-block consent-block">
          <h2>Connect your account</h2>
          <p role="status">Waiting for confirmation from ChatGPT…</p>
          @if (verificationUrl()) {
            <ol class="consent-steps">
              <li>Open the ChatGPT verification page.</li>
              <li>Enter your one-time code.</li>
              <li>Confirm access, then return here.</li>
            </ol>
            <div class="code-block"><span>Your one-time code</span><strong class="user-code" data-testid="chatgpt-user-code">{{ connection()?.userCode }}</strong></div>
            <a class="primary-button verification-link" [href]="verificationUrl()" target="_blank" rel="noopener noreferrer">Open ChatGPT verification<span aria-hidden="true">↗</span></a>
            <p class="hint">Opens in a new tab. Never share this code with another person.</p>
          }
          <button class="text-button" (click)="disconnect()" [disabled]="busy() && operation() !== 'poll'">Cancel connection</button>
        </div>
      } @else if (connection()?.status === 'connected') {
        <div class="connection-row"><span class="connected-label" role="status"><span class="status-dot" aria-hidden="true"></span>ChatGPT connected</span>
          <button class="text-button" (click)="disconnect()" [disabled]="operation() === 'disconnect'">Disconnect</button>
        </div>
      } @else {
        <div class="state-block connect-block">
          <h2>{{ connection()?.status === 'expired' ? 'Reconnect to continue' : 'Connect your ChatGPT account' }}</h2>
          @if (connection()?.status === 'expired') { <p role="status">Your connection expired. Connect again to continue.</p> }
          @else { <p>Use your personal account for online study help. Your LMS sign-in stays the same.</p> }
          <button class="primary-button" (click)="connect()" [disabled]="busy()">{{ operation() === 'start' ? 'Starting connection…' : 'Connect ChatGPT' }}</button>
          <p class="hint">You complete consent on ChatGPT’s website. This LMS never asks for your ChatGPT password.</p>
        </div>
      }

      @if (error()) { <div class="error-block" role="alert"><strong>Request not completed</strong><p>{{ error() }}</p></div> }

      @if (showDraft()) {
        <form class="question-form" (submit)="send($event)">
          @if (!question().trim() && !answer()) {
            <p class="starter-heading">Start with a study task</p>
            <div class="starter-list" aria-label="Study question starters">
              <button class="starter-button" type="button" [disabled]="busy()" (click)="fillPrompt('Explain this concept in plain language, with one practical example: ')">Explain a concept</button>
              <button class="starter-button" type="button" [disabled]="busy()" (click)="fillPrompt('Create three practice questions about this topic, with answers at the end: ')">Practice questions</button>
              <button class="starter-button" type="button" [disabled]="busy()" (click)="fillPrompt('Help me make a short revision plan for this topic: ')">Revision plan</button>
            </div>
          }
          <div class="question-label"><label for="chatgpt-question">Your study question</label><span class="character-count" aria-label="Characters used">{{ question().length }} / 2,000</span></div>
          <textarea #questionInput id="chatgpt-question" rows="4" maxlength="2000" [value]="question()"
            placeholder="What would you like to understand better?"
            (input)="updateQuestion($event)" [disabled]="busy()" aria-describedby="chatgpt-question-help"></textarea>
          <button class="passage-button" type="button" [disabled]="busy()" (click)="addSelectedPassage()">Add selected passage</button>
          @if (draftMessage()) { <p class="hint" role="status">{{ draftMessage() }}</p> }
          <p id="chatgpt-question-help" class="hint">Only this draft is sent, including any passage you add. Leave out personal or confidential information.</p>
          @if (offline() || needsResume()) {
            <p class="draft-note">Draft only. Closing this panel or changing provider clears the draft.</p>
          }
          <div class="send-row"><span class="send-hint">{{ offline() ? 'Reconnect to send' : needsResume() ? 'Resume before sending' : connection()?.status !== 'connected' ? 'Connect before sending' : 'One question at a time' }}</span><button class="primary-button" type="submit" [disabled]="!canSend()">{{ operation() === 'ask' ? 'Getting answer…' : 'Send question' }}</button></div>
        </form>
        @if (answer()) {
          <div class="answer-heading"><h2>Your answer</h2><span>ChatGPT</span></div>
          <div class="answer" role="region" aria-label="ChatGPT answer" aria-live="polite" tabindex="0" data-testid="chatgpt-answer">{{ answer() }}</div>
          <p class="hint answer-caution">Check important information against your course material. AI can make mistakes.</p>
        }
      }

      <details class="privacy-details"><summary>What is shared with ChatGPT?</summary><p>Only your question and any passage you choose to add are shared when you send. Course content, learning records, and past questions are not uploaded automatically. This is an experimental personal connection, separate from your LMS sign-in.</p></details>
    </section>
  `,
  styles: [`
    :host { display:block; flex:1; min-height:0; min-width:0; overflow:auto; background:var(--c-surface,#fff); color:var(--c-text,#0a2a43); }
    *, *::before, *::after { box-sizing:border-box; }
    .assistant-body { padding:1.125rem; font:inherit; font-size:.875rem; line-height:1.55; }
    .assistant-intro { margin-bottom:1.125rem; }
    .capability-line { display:flex; align-items:center; justify-content:space-between; gap:.5rem; flex-wrap:wrap; }
    .cloud-label { display:inline-flex; align-items:center; gap:.375rem; font-size:.75rem; font-weight:600; }
    svg { width:1rem; height:1rem; flex-shrink:0; }
    .experimental-label { font-size:.6875rem; color:var(--c-muted,#4b5565); border:1px solid var(--c-border,#dce3e9); border-radius:.25rem; padding:.125rem .375rem; }
    .intro-copy { font-size:.875rem; margin:.75rem 0; color:var(--c-muted,#4b5565); text-wrap:pretty; }
    .offline-note { display:flex; gap:.5rem; align-items:center; margin:0; padding:.625rem .75rem; border-radius:.5rem; background:var(--c-bg,#f8fafc); font-size:.75rem; color:var(--c-muted,#4b5565); }
    h2 { font-size:1rem; line-height:1.4; font-weight:600; letter-spacing:-.015em; margin:0 0 .5rem; }
    p { overflow-wrap:anywhere; }
    .state-block { padding:1rem; border:1px solid var(--c-border,#dce3e9); border-radius:.75rem; margin-bottom:1rem; }
    .state-block p { margin:.5rem 0 .875rem; }
    .state-block .hint { margin-bottom:0; }
    button, .primary-button { font:inherit; min-height:2.75rem; border-radius:.5rem; cursor:pointer; transition:background-color 150ms ease, border-color 150ms ease; }
    .primary-button { border:1px solid transparent; padding:.625rem .875rem; color:#fff; background:var(--c-primary,#1c5c86); font-weight:600; text-align:center; }
    .primary-button:hover:not(:disabled) { background:#16496b; }
    button:active:not(:disabled) { transform:translateY(1px); }
    button:disabled { opacity:.55; cursor:default; }
    button:focus-visible, a:focus-visible, textarea:focus-visible, .answer:focus-visible, summary:focus-visible { outline:2px solid var(--c-text,#0a2a43); outline-offset:3px; }
    .text-button { padding:.375rem .5rem; border:0; background:transparent; color:var(--c-primary,#1c5c86); font-size:.8125rem; text-decoration:underline; text-underline-offset:3px; }
    .text-button:hover:not(:disabled) { background:var(--c-bg,#f8fafc); }
    .connect-block .primary-button { width:100%; }
    .consent-steps { padding-left:1.25rem; margin:.875rem 0; color:var(--c-muted,#4b5565); }
    .consent-steps li { padding-left:.25rem; margin:.375rem 0; }
    .code-block { padding:.75rem; margin:.875rem 0; background:var(--c-bg,#f8fafc); border-radius:.5rem; }
    .code-block>span { font-size:.75rem; color:var(--c-muted,#4b5565); }
    .user-code { display:block; font-family:ui-monospace,SFMono-Regular,Consolas,monospace; font-size:1.5rem; letter-spacing:.1em; line-height:1.6; overflow-wrap:anywhere; }
    .verification-link { display:flex; align-items:center; justify-content:space-between; gap:.5rem; text-decoration:none; }
    .consent-block .text-button { margin-top:.5rem; }
    .connection-row { display:flex; justify-content:space-between; align-items:center; gap:.5rem; padding-bottom:.625rem; border-bottom:1px solid var(--c-border,#dce3e9); }
    .connected-label { display:inline-flex; align-items:center; gap:.4375rem; font-size:.8125rem; font-weight:600; }
    .status-dot { width:.4375rem; height:.4375rem; border-radius:50%; background:var(--c-primary,#1c5c86); }
    .question-form { margin-top:1rem; }
    .starter-heading { margin:0 0 .5rem; color:var(--c-muted,#4b5565); font-size:.75rem; }
    .starter-list { display:flex; flex-wrap:wrap; gap:.375rem; margin-bottom:1rem; }
    .starter-button { padding:.5rem .625rem; border:1px solid var(--c-border,#dce3e9); background:var(--c-bg,#f8fafc); color:var(--c-text,#0a2a43); font-size:.75rem; text-align:left; }
    .starter-button:hover:not(:disabled) { border-color:var(--c-primary,#1c5c86); }
    .passage-button { padding:.375rem 0; min-height:2.75rem; background:transparent; border:0; color:var(--c-primary,#1c5c86); font-size:.75rem; text-decoration:underline; text-underline-offset:3px; }
    .question-label { display:flex; align-items:baseline; justify-content:space-between; gap:.5rem; margin-bottom:.5rem; }
    label { font-size:.8125rem; font-weight:600; }
    .character-count { white-space:nowrap; color:var(--c-muted,#4b5565); font-size:.6875rem; font-variant-numeric:tabular-nums; }
    textarea { display:block; width:100%; min-height:7.5rem; padding:.75rem; border:1px solid #a9b6c3; border-radius:.5rem; resize:vertical; color:inherit; background:var(--c-surface,#fff); font:inherit; line-height:1.5; }
    textarea::placeholder { color:var(--c-muted,#4b5565); opacity:.8; }
    .hint { color:var(--c-muted,#4b5565); font-size:.75rem; line-height:1.5; }
    .draft-note { padding-left:.625rem; border-left:2px solid var(--c-primary,#1c5c86); color:var(--c-muted,#4b5565); font-size:.75rem; }
    .send-row { display:flex; align-items:center; justify-content:space-between; gap:.5rem; margin-top:.75rem; }
    .send-hint { color:var(--c-muted,#4b5565); font-size:.6875rem; }
    .answer-heading { display:flex; justify-content:space-between; align-items:baseline; margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--c-border,#dce3e9); }
    .answer-heading h2 { font-size:.875rem; margin:0 0 .625rem; }
    .answer-heading>span { color:var(--c-muted,#4b5565); font-size:.6875rem; }
    .answer { white-space:pre-wrap; overflow-wrap:anywhere; max-height:26rem; overflow:auto; padding:.875rem; border-radius:.625rem; background:var(--c-bg,#f8fafc); line-height:1.7; }
    .answer-caution { margin-bottom:0; }
    .error-block { border-left:3px solid #b42318; background:#fff5f4; color:#922017; padding:.75rem; border-radius:0 .5rem .5rem 0; margin:1rem 0; font-size:.8125rem; }
    .error-block p { margin:.25rem 0 0; }
    .privacy-details { margin-top:1.25rem; padding-top:.875rem; border-top:1px solid var(--c-border,#dce3e9); color:var(--c-muted,#4b5565); font-size:.75rem; }
    summary { cursor:pointer; min-height:2.75rem; }
    .privacy-details p { margin:.5rem 0 0; }
    .loading-lines { display:grid; gap:.5rem; padding-top:.5rem; }
    .loading-lines span { display:block; height:.5rem; width:90%; border-radius:.25rem; background:var(--c-border,#dce3e9); }
    .loading-lines span:last-child { width:65%; }
    @media (max-width: 380px) { .assistant-body { padding:1rem; } .state-block { padding:.875rem; } .send-row { align-items:stretch; flex-direction:column; } }
    @media (prefers-reduced-motion: reduce) { button, .primary-button { transition:none; } button:active:not(:disabled) { transform:none; } }
  `],
})
export class ChatgptPanelComponent implements OnInit, OnDestroy {
  private readonly api = inject(ChatgptApiService);
  private readonly network = inject(NetworkStatusService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly offline = computed(() => !this.network.online());
  readonly connection = signal<ChatgptStatus | null>(null);
  readonly operation = signal<'status' | 'start' | 'poll' | 'ask' | 'disconnect' | null>(null);
  readonly busy = computed(() => this.operation() !== null);
  readonly question = signal('');
  readonly draftMessage = signal('');
  readonly showDraft = computed(() => this.offline() || this.connection()?.status === 'connected' || !!this.question().trim());
  readonly canSend = computed(() => !this.offline() && !this.needsResume() && !this.busy()
    && this.connection()?.status === 'connected' && !!this.question().trim());
  private readonly questionInput = viewChild<ElementRef<HTMLTextAreaElement>>('questionInput');
  readonly answer = signal('');
  readonly error = signal('');
  readonly needsResume = signal(false);
  readonly verificationUrl = computed(() => {
    const uri = this.connection()?.verificationUri;
    return uri === 'https://auth.openai.com/codex/device' ? uri : null;
  });
  private request?: Subscription;
  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private destroyed = false;

  constructor() {
    effect(() => {
      if (!this.network.online()) {
        this.cancelWork();
        this.needsResume.set(true);
      }
    });
  }

  ngOnInit(): void { this.resume(); }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.cancelWork();
    this.question.set('');
    this.answer.set('');
    this.draftMessage.set('');
  }

  resume(): void {
    if (this.blocked()) return;
    this.needsResume.set(false);
    this.run('status', this.api.status(), state => this.accept(state));
  }

  connect(): void {
    if (this.blocked()) return;
    this.run('start', this.api.start(), state => this.accept(state));
  }

  disconnect(): void {
    if (this.network.isEffectivelyOffline() || this.destroyed || this.operation() === 'disconnect') return;
    this.cancelWork();
    this.question.set('');
    this.answer.set('');
    this.draftMessage.set('');
    this.run('disconnect', this.api.disconnect(), state => this.accept(state));
  }

  fillPrompt(prompt: string): void {
    if (this.destroyed || this.busy() || this.question().trim()) return;
    this.question.set(prompt);
    this.draftMessage.set('');
    this.questionInput()?.nativeElement.focus();
  }

  addSelectedPassage(): void {
    if (this.destroyed || this.busy() || typeof window === 'undefined') return;
    const selection = window.getSelection();
    const passage = selection?.toString() ?? '';
    if (!selection?.rangeCount || !passage.trim()) {
      this.draftMessage.set('Select a passage in your lesson first, then add it here.');
      return;
    }
    const assistant = this.host.nativeElement.closest('app-chat-panel') ?? this.host.nativeElement;
    for (let index = 0; index < selection.rangeCount; index++) {
      if (selection.getRangeAt(index).intersectsNode(assistant)) {
        this.draftMessage.set('Select text outside the assistant, such as a passage in your lesson.');
        return;
      }
    }
    const separator = this.question().trim() ? '\n\nSelected passage:\n' : 'Selected passage:\n';
    const available = 2000 - this.question().length - separator.length;
    if (passage.length > available) {
      this.draftMessage.set(`Select a shorter passage. Your draft has room for ${Math.max(0, available)} more characters.`);
      return;
    }
    this.question.update(question => question + separator + passage);
    this.draftMessage.set('Passage added to your draft. Review it before sending.');
    this.questionInput()?.nativeElement.focus();
  }

  updateQuestion(event: Event): void {
    this.draftMessage.set('');
    this.question.set((event.target as HTMLTextAreaElement).value.slice(0, 2000));
  }

  send(event: Event): void {
    event.preventDefault();
    const question = this.question().trim();
    if (this.blocked() || this.needsResume() || this.connection()?.status !== 'connected' || !question || question.length > 2000) return;
    this.answer.set('');
    this.run('ask', this.api.ask(question), result => {
      this.answer.set(result.answer.slice(0, 20_000));
      this.question.set('');
      this.draftMessage.set('');
    });
  }

  private blocked(): boolean {
    if (this.destroyed) return true;
    if (this.network.isEffectivelyOffline()) {
      this.cancelWork();
      this.needsResume.set(true);
      return true;
    }
    return this.busy();
  }

  private cancelWork(): void {
    this.generation++;
    this.request?.unsubscribe();
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.operation.set(null);
  }

  private accept(state: ChatgptStatus): void {
    this.connection.set(state);
    if (state.status !== 'pending') return;
    const expires = Date.parse(state.expiresAt ?? '');
    if (!state.attemptId || !state.userCode || !this.verificationUrl() || !Number.isFinite(expires)) {
      this.error.set('Unable to verify the connection details. Cancel and try again.');
      return;
    }
    const remaining = expires - Date.now();
    if (remaining <= 0) {
      this.connection.set({ enabled: state.enabled, status: 'expired' });
      return;
    }
    const wait = Math.max(5, Math.min(60, state.intervalSeconds ?? 5)) * 1000;
    const generation = this.generation;
    this.timer = setTimeout(() => {
      if (generation !== this.generation || this.blocked() || this.needsResume()) return;
      if (Date.now() >= expires) {
        this.connection.set({ enabled: state.enabled, status: 'expired' });
        return;
      }
      this.run('poll', this.api.poll(state.attemptId!), next => this.accept(next));
    }, Math.min(wait, remaining));
  }

  private run<T>(operation: NonNullable<ReturnType<typeof this.operation>>, request: Observable<T>, success: (value: T) => void): void {
    this.cancelWork();
    const generation = this.generation;
    this.operation.set(operation);
    this.error.set('');
    this.request = request.subscribe({
      next: value => {
        if (generation !== this.generation || this.destroyed) return;
        this.operation.set(null);
        success(value);
      },
      error: (cause: unknown) => {
        if (generation !== this.generation || this.destroyed) return;
        this.operation.set(null);
        const status = cause instanceof HttpErrorResponse ? cause.status : 0;
        const code = cause instanceof HttpErrorResponse ? cause.error?.error?.code : null;
        const expired = code === 'expired' || code === 'unauthorized';
        if (status === 401 || expired) {
          this.connection.set({ enabled: true, status: 'expired' });
          this.answer.set('');
        }
        this.error.set(status === 429
          ? 'ChatGPT is busy or rate limited. Wait a moment, then try again.'
          : status === 401
            ? 'Your LMS session expired. Sign in to the LMS again, then reconnect ChatGPT.'
          : expired
            ? 'Your connection expired. Connect again to continue.'
          : code === 'model_not_supported'
            ? 'Your ChatGPT connection is valid, but this LMS is using an unsupported model. Ask the LMS administrator to configure a supported model, then send your question again.'
            : 'ChatGPT could not complete this request. Try again when your connection is ready.');
        if (operation === 'poll' || status === 0) this.needsResume.set(true);
      },
    });
  }
}
