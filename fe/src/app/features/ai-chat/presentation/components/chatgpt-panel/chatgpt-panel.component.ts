import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subscription } from 'rxjs';
import { NetworkStatusService } from '../../../../../core/services/network-status.service';
import { ChatgptApiService, ChatgptStatus } from '../../../infrastructure/api/chatgpt-api.service';

@Component({
  selector: 'app-chatgpt-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-label="ChatGPT study assistant" [attr.aria-busy]="busy()">
      <p class="notice"><strong>Experimental personal connection</strong><br>
        Connect your own ChatGPT account for online study help. This does not change your LMS sign-in.
        Only the question you send is shared. Course content and learning records are not uploaded.</p>

      @if (offline()) {
        <p role="status">ChatGPT needs an internet connection. You can continue with downloaded lessons.</p>
      } @else if (needsResume()) {
        <p role="status">Connection interrupted. Nothing will be resent automatically.</p>
        <button (click)="resume()" [disabled]="busy()">Resume connection</button>
      } @else if (connection()?.enabled === false) {
        <p role="status">ChatGPT is not enabled on this LMS.</p>
      } @else if (!connection()) {
        <p role="status">{{ busy() ? 'Checking connection…' : 'Unable to check the ChatGPT connection.' }}</p>
        @if (!busy()) { <button (click)="resume()">Retry connection check</button> }
      } @else if (connection()?.status === 'pending') {
        <p role="status">Complete consent in ChatGPT, then return here. Waiting for confirmation…</p>
        @if (verificationUrl()) {
          <a [href]="verificationUrl()" target="_blank" rel="noopener noreferrer">Open ChatGPT verification</a>
          <p>Your one-time code: <strong class="user-code" data-testid="chatgpt-user-code">{{ connection()?.userCode }}</strong></p>
        }
        <button class="secondary" (click)="disconnect()" [disabled]="busy() && operation() !== 'poll'">Cancel connection</button>
      } @else if (connection()?.status === 'connected') {
        <div class="connection-row"><span role="status">ChatGPT connected</span>
          <button class="secondary" (click)="disconnect()" [disabled]="operation() === 'disconnect'">Disconnect</button>
        </div>
        <form (submit)="send($event)">
          <label for="chatgpt-question">Your study question</label>
          <textarea id="chatgpt-question" rows="4" maxlength="2000" [value]="question()"
            (input)="updateQuestion($event)" [disabled]="busy()" aria-describedby="chatgpt-question-help"></textarea>
          <p id="chatgpt-question-help" class="hint">One question at a time, up to 2,000 characters. Do not include personal or confidential information.</p>
          <button type="submit" [disabled]="busy() || !question().trim()">{{ operation() === 'ask' ? 'Getting answer…' : 'Send question' }}</button>
        </form>
        @if (answer()) {
          <div class="answer" role="region" aria-label="ChatGPT answer" aria-live="polite" tabindex="0" data-testid="chatgpt-answer">{{ answer() }}</div>
          <p class="hint">AI can make mistakes. Check important information against your course material.</p>
        }
      } @else {
        @if (connection()?.status === 'expired') { <p role="status">Your connection expired. Connect again to continue.</p> }
        <button (click)="connect()" [disabled]="busy()">{{ operation() === 'start' ? 'Starting connection…' : 'Connect ChatGPT' }}</button>
        <p class="hint">You complete consent on ChatGPT's website. This LMS never asks for your ChatGPT password.</p>
      }
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    </section>
  `,
  styles: [`
    :host { display:block; flex:1; min-height:0; overflow:auto; }
    section { padding:16px; font-size:14px; color:#263244; line-height:1.5; }
    .notice { margin-top:0; padding:12px; background:#f0f5ff; border-radius:8px; font-size:12px; }
    button { background:#0056d2; color:white; padding:9px 12px; border:0; border-radius:7px; cursor:pointer; }
    button:disabled { opacity:.6; cursor:default; }
    button.secondary { background:#eef2f7; color:#263244; }
    button:focus-visible, a:focus-visible, textarea:focus-visible, .answer:focus-visible { outline:3px solid #5c91db; outline-offset:3px; }
    a { color:#0056d2; text-decoration:underline; }
    label { display:block; font-weight:600; margin:16px 0 6px; }
    textarea { width:100%; box-sizing:border-box; padding:10px; border:1px solid #a9b4c5; border-radius:7px; resize:vertical; color:inherit; }
    .connection-row { display:flex; justify-content:space-between; align-items:center; gap:8px; }
    .hint { color:#576477; font-size:12px; }
    .user-code { display:block; font-size:22px; letter-spacing:2px; overflow-wrap:anywhere; }
    .answer { white-space:pre-wrap; overflow-wrap:anywhere; margin-top:16px; padding:12px; border:1px solid #d6deea; border-radius:8px; max-height:420px; overflow:auto; }
    .error { color:#b42318; }
  `],
})
export class ChatgptPanelComponent implements OnInit, OnDestroy {
  private readonly api = inject(ChatgptApiService);
  private readonly network = inject(NetworkStatusService);
  readonly offline = computed(() => !this.network.online());
  readonly connection = signal<ChatgptStatus | null>(null);
  readonly operation = signal<'status' | 'start' | 'poll' | 'ask' | 'disconnect' | null>(null);
  readonly busy = computed(() => this.operation() !== null);
  readonly question = signal('');
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
    this.run('disconnect', this.api.disconnect(), state => this.accept(state));
  }

  updateQuestion(event: Event): void {
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
