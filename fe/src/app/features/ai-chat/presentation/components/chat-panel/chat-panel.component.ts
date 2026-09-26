/**
 * ChatPanelComponent — Sprint 220c: "Nhúng Wiii Pro"
 *
 * Embeds Wiii AI directly via iframe instead of proxying through LMS backend.
 * Auth is passed via URL hash fragment (not sent to server — secure by spec).
 *
 * Supports two display modes:
 *   - "sidebar" (default): Fills parent container, no fixed positioning — used as right sidebar in layout
 *   - "widget": Fixed position popup at bottom-right — used on mobile
 *
 * Architecture:
 *   Browser → iframe(Wiii Embed) → Wiii AI directly
 *   Latency: ~1-3s (single hop, direct SSE) vs ~3-7s (double hop via LMS proxy)
 */
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  effect,
  computed,
  untracked,
  HostListener,
  OnInit,
  OnDestroy,
  ElementRef,
  viewChild,
} from '@angular/core';

import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AiTokenService } from '../../../infrastructure/api/ai-token.service';
import { SessionManagementService } from '../../../application/services/session-management.service';
import { WiiiContextService } from '../../../infrastructure/api/wiii-context.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { NetworkStatusService } from '../../../../../core/services/network-status.service';
import { environment } from '../../../../../../environments/environment';
import { AiAvailabilityService } from '../../../application/services/ai-availability.service';
import { ChatgptPanelComponent } from '../chatgpt-panel/chatgpt-panel.component';

@Component({
  selector: 'app-chat-panel',
  imports: [ChatgptPanelComponent],
  template: `
    <div
      class="chat-panel"
      [class.sidebar-mode]="mode() === 'sidebar'"
      [class.widget-mode]="mode() === 'widget'"
      [class.mobile]="isMobile() && mode() === 'widget'"
      [class.visible]="isVisible()"
    >
      <!-- Header -->
      <div class="panel-header">
        <div class="header-title">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="header-icon">
            <path fill-rule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5z" clip-rule="evenodd" />
          </svg>
          <span>{{ provider() === 'chatgpt' ? 'ChatGPT' : 'Wiii' }}</span>
        </div>
        <div class="header-actions">
          @if (provider() === 'wiii' && mode() === 'sidebar') {
            <button class="new-chat-button" (click)="clearChat()" title="Cuộc trò chuyện mới">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
              </svg>
            </button>
          }
          @if (provider() === 'wiii') {
          <button class="expand-button" (click)="openFullWiii()" title="Mở toàn màn hình">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.28 7.78l3.22-3.22v2.69a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.69l-3.22 3.22a.75.75 0 001.06 1.06zM2 17.25v-4.5a.75.75 0 011.5 0v2.69l3.22-3.22a.75.75 0 011.06 1.06L4.56 16.5h2.69a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75z" />
            </svg>
          </button>
          }
          <button class="close-button" (click)="onClose()" title="Đóng" aria-label="Đóng trợ lý AI">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </div>

      @if (availability.chatgptEnabled()) {
        <div class="provider-picker">
          <label for="ai-provider">AI provider</label>
          <select id="ai-provider" aria-label="AI provider" [value]="provider()" (change)="changeProvider($event)">
            <option value="wiii" [disabled]="!availability.wiiiAvailable()">Wiii</option>
            <option value="chatgpt">ChatGPT (experimental)</option>
          </select>
        </div>
      }

      <!-- Offline state — shown when device has no connectivity -->
      @if (provider() === 'chatgpt') {
        <app-chatgpt-panel />
      } @else if (isOffline()) {
        <div class="offline-state" role="status" aria-live="polite">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="offline-icon" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18M8.111 8.111A5.97 5.97 0 006 12c0 1.657.672 3.157 1.757 4.243M10.586 10.586A2 2 0 0112 10a2 2 0 012 2 2 2 0 01-.586 1.414M16.243 16.243A5.97 5.97 0 0018 12a5.97 5.97 0 00-1.757-4.243M12 20.5V21" />
          </svg>
          <p class="offline-heading">Không có kết nối mạng</p>
          <p class="offline-guidance">
            Trợ lý AI cần kết nối internet. Trong khi đó bạn có thể tiếp tục
            với <strong>bài học đã tải về</strong>.
          </p>
        </div>

      <!--
        Reconnect-ready state — device is back online but no init has run yet.
        A single deliberate retry is offered; the button is outside the offline
        block so it stays visible once isOffline() flips back to false.
      -->
      } @else if (offlineReconnectReady()) {
        <div class="offline-state" role="status" aria-live="polite">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="offline-icon" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.111 8.111A5.97 5.97 0 006 12a5.97 5.97 0 005.97 5.97 5.97 5.97 0 005.97-5.97 5.97 5.97 0 00-1.757-4.243M12 3v1m0 16v1" />
          </svg>
          <p class="offline-heading">Đã kết nối lại</p>
          <p class="offline-guidance">Kết nối mạng đã được khôi phục.</p>
          <button class="retry-button" (click)="retryInit()" aria-label="Thử kết nối lại trợ lý AI">
            Kết nối trợ lý AI
          </button>
        </div>

      <!-- Wiii iframe (fills remaining space) -->
      } @else if (embedUrl()) {
        <!--
          Security note:
          Wiii runs on a trusted, separate origin. allow-same-origin is intentional
          so the embed keeps its own storage/auth/fetch behavior; the host bridge
          still fail-closes on exact origin checks in WiiiContextService.
          initEmbed() also refuses same-origin embedding to avoid an accidental
          sandbox escape risk from allow-scripts + allow-same-origin.
        -->
        <iframe
          #wiiiIframe
          [src]="embedUrl()"
          class="wiii-embed-frame"
          data-wiii-id="wiii-iframe"
          allow="clipboard-write; autoplay"
          referrerpolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="Wiii AI Chat"
        ></iframe>
      } @else if (loadError()) {
        <div class="error-state" role="alert">
          <span>Không thể kết nối AI. Vui lòng thử lại sau.</span>
          <button (click)="retryInit()" aria-label="Thử kết nối lại trợ lý AI">Thử lại</button>
        </div>
      } @else {
        <div class="loading-state" role="status" aria-live="polite">
          <div class="loading-spinner" aria-hidden="true"></div>
          <span>Đang kết nối AI...</span>
        </div>
      }
    </div>
  `,
  styles: [`
    /* Host element — must stretch inside flex-column parents (sidebar) */
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    /* =========================================================
       BASE — shared between sidebar and widget modes
       ========================================================= */
    .chat-panel {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: white;
      overflow: hidden;
    }
    .provider-picker { padding:10px 14px; border-bottom:1px solid #ebebeb; }
    .provider-picker label { display:block; margin-bottom:4px; font-size:12px; color:#576477; }
    .provider-picker select { width:100%; padding:7px; border:1px solid #a9b4c5; border-radius:6px; background:white; color:#263244; }

    /* =========================================================
       SIDEBAR MODE — fills parent container, no fixed positioning
       Used as right sidebar in desktop layout
       ========================================================= */
    .chat-panel.sidebar-mode {
      width: 100%;
      height: 100%;
      min-width: 0;
      border-radius: 0;
      box-shadow: none;
      opacity: 1;
      pointer-events: auto;
    }

    .chat-panel.sidebar-mode .wiii-embed-frame {
      border-radius: 0;
    }

    /* Sidebar header — clean minimal (Claude.ai style) */
    .chat-panel.sidebar-mode .panel-header {
      background: #ffffff;
      color: #1a1a2e;
      border-bottom: 1px solid #ebebeb;
      padding: 13px 14px;
    }

    .chat-panel.sidebar-mode .header-icon {
      color: #0056D2;
    }

    .chat-panel.sidebar-mode .header-title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .chat-panel.sidebar-mode .new-chat-button,
    .chat-panel.sidebar-mode .expand-button,
    .chat-panel.sidebar-mode .close-button {
      background: transparent;
      color: #9ca3af;
      border-radius: 6px;
      width: 28px;
      height: 28px;
    }

    .chat-panel.sidebar-mode .new-chat-button:hover,
    .chat-panel.sidebar-mode .expand-button:hover,
    .chat-panel.sidebar-mode .close-button:hover {
      background: #f3f4f6;
      color: #374151;
    }

    .chat-panel.sidebar-mode .new-chat-button svg,
    .chat-panel.sidebar-mode .expand-button svg,
    .chat-panel.sidebar-mode .close-button svg {
      width: 15px;
      height: 15px;
    }

    /* =========================================================
       WIDGET MODE — fixed position popup (mobile fallback)
       ========================================================= */
    .chat-panel.widget-mode {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      height: 520px;
      max-height: calc(100vh - 120px);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      z-index: 999;
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .chat-panel.widget-mode.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    .chat-panel.widget-mode.mobile {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
      max-height: 100%;
      border-radius: 0;
    }

    .chat-panel.widget-mode .wiii-embed-frame {
      border-radius: 0 0 16px 16px;
    }

    .chat-panel.widget-mode.mobile .wiii-embed-frame {
      border-radius: 0;
    }

    /* =========================================================
       HEADER
       ========================================================= */
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: linear-gradient(135deg, #0056D2 0%, #004BB5 100%);
      color: white;
      flex-shrink: 0;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 15px;
      font-weight: 600;
    }

    .header-icon {
      width: 22px;
      height: 22px;
    }

    .header-actions {
      display: flex;
      gap: 4px;
    }

    .new-chat-button,
    .expand-button,
    .close-button {
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.15);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .new-chat-button:hover,
    .expand-button:hover,
    .close-button:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    .new-chat-button svg,
    .expand-button svg,
    .close-button svg {
      width: 16px;
      height: 16px;
    }

    /* =========================================================
       IFRAME
       ========================================================= */
    .wiii-embed-frame {
      width: 100%;
      flex: 1;
      border: none;
    }

    /* =========================================================
       LOADING / ERROR / OFFLINE STATES
       ========================================================= */
    .loading-state,
    .error-state,
    .offline-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 24px;
      font-size: 14px;
      text-align: center;
    }

    .loading-state {
      gap: 16px;
      color: #6b7280;
    }

    .loading-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e5e7eb;
      border-top-color: #0056D2;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-state {
      color: #dc2626;
    }

    /* Offline state */
    .offline-state {
      color: #374151;
    }

    .offline-icon {
      width: 48px;
      height: 48px;
      color: #9ca3af;
    }

    .offline-heading {
      font-size: 15px;
      font-weight: 600;
      margin: 0;
      color: #111827;
    }

    .offline-guidance {
      margin: 0;
      color: #6b7280;
      line-height: 1.5;
      max-width: 260px;
    }

    .error-state button,
    .retry-button {
      padding: 8px 16px;
      background: #0056D2;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
    }

    .error-state button:hover,
    .retry-button:hover {
      background: #004BB5;
    }

    /* =========================================================
       MOBILE OVERRIDES (widget mode only)
       ========================================================= */
    @media (max-width: 767px) {
      .chat-panel.widget-mode {
        bottom: 0;
        right: 0;
      }

      .expand-button {
        display: none;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPanelComponent implements OnInit, OnDestroy {
  private readonly tokenService = inject(AiTokenService);
  private readonly sessionService = inject(SessionManagementService);
  private readonly contextService = inject(WiiiContextService);
  private readonly authService = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly networkStatus = inject(NetworkStatusService);
  readonly availability = inject(AiAvailabilityService);
  readonly provider = signal<'wiii' | 'chatgpt'>('wiii');

  // Inputs
  mode = input<'sidebar' | 'widget'>('sidebar');

  // Outputs
  closePanel = output<void>();

  // State
  isVisible = signal(true);
  isMobile = signal(false);
  embedUrl = signal<SafeResourceUrl | null>(null);
  loadError = signal(false);

  /**
   * True when the device is offline (derived from NetworkStatusService).
   * Offline state takes priority over loadError/loading in the template.
   */
  readonly isOffline = computed(() => !this.networkStatus.online());

  /**
   * True once connectivity is restored while the offline state is showing,
   * so the panel offers a single deliberate retry rather than auto-reiniting.
   * Reset on every retryInit() call to avoid duplicate in-flight requests.
   */
  offlineReconnectReady = signal(false);

  // View child for postMessage bridge
  wiiiIframe = viewChild<ElementRef<HTMLIFrameElement>>('wiiiIframe');

  // Track message listener for cleanup
  private messageHandler: ((event: MessageEvent) => void) | null = null;

  /**
   * Destroyed flag — prevents stale async init results from committing after
   * ngOnDestroy(). Set once; never reset.
   */
  private destroyed = false;

  /** Token used to abort a pending init when the component is destroyed or goes offline. */
  private initGeneration = 0;

  /**
   * True while initEmbed() is awaiting getToken(). Signal so the restore effect
   * re-evaluates reactively when the in-flight call settles.
   * - Prevents double-click from issuing a second request (retryInit is no-op if in-flight)
   * - Prevents the reconnect-restore effect from surfacing the retry button during normal online init
   * - When the promise settles (finally), the signal update triggers the effect to re-evaluate
   *   and surface the retry button if connectivity has already returned.
   */
  private readonly initInFlight = signal(false);

  /**
   * True while a token-refresh response is in-flight for wiii:auth-expired.
   * Prevents duplicate refresh requests if the iframe sends the event twice.
   */
  private refreshPending = false;

  constructor() {
    effect(() => {
      const chatgpt = this.availability.chatgptEnabled();
      const wiii = this.availability.wiiiAvailable();
      untracked(() => {
        if (chatgpt && !wiii && this.provider() === 'wiii') this.selectProvider('chatgpt');
        else if (wiii && this.provider() === 'wiii' && !this.embedUrl() && !this.loadError()
          && !this.offlineReconnectReady()) this.initEmbed();
      });
    });
    // Sprint 221: Connect iframe to WiiiContextService for page-aware AI.
    // When the iframe viewChild becomes available (after embedUrl is set),
    // attach a load listener so we connect after the Wiii embed app initializes.
    effect((onCleanup) => {
      const ref = this.wiiiIframe();
      if (ref) {
        const iframe = ref.nativeElement;
        const onLoad = () => this.contextService.connectIframe(iframe);
        iframe.addEventListener('load', onLoad, { once: true });
        onCleanup(() => {
          iframe.removeEventListener('load', onLoad);
          this.contextService.disconnectIframe();
        });
      }
    });

    // When connectivity is lost: invalidate the in-flight init so its result is
    // discarded, clear any stale embed, and release the in-flight lock so that
    // when connectivity returns the restore effect fires immediately.
    effect(() => {
      const online = this.networkStatus.online();
      if (!online) {
        this.initGeneration++;
        this.initInFlight.set(false);  // release lock; stale promise will no-op on generation check
        this.embedUrl.set(null);
        this.loadError.set(false);
        this.offlineReconnectReady.set(false);
      }
    });

    // When connectivity returns and nothing is running or loaded, offer retry.
    effect(() => {
      const online = this.networkStatus.online();
      const inFlight = this.initInFlight();
      if (online && !inFlight && !untracked(() => this.embedUrl()) && !untracked(() => this.loadError())) {
        this.offlineReconnectReady.set(true);
      }
    });
  }

  ngOnInit(): void {
    this.checkMobile();
    if (!this.networkStatus.isEffectivelyOffline() && this.availability.wiiiAvailable()) {
      this.initEmbed();
    }
    // If offline on open, offlineReconnectReady stays false until online signal fires.
    this.setupMessageBridge();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.initGeneration++;          // invalidate any in-flight promise
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkMobile();
  }

  private checkMobile(): void {
    if (typeof window !== 'undefined') {
      this.isMobile.set(window.innerWidth < 768);
    }
  }

  /**
   * Initialize embed by exchanging token and building iframe URL.
   * Auth is passed via URL hash fragment (secure — not sent to server).
   *
   * Guards:
   * - Skips if device is offline at call time.
   * - Aborts if component is destroyed while the token exchange is in-flight
   *   (generation token check) to prevent a stale embedUrl from being set.
   */
  async initEmbed(): Promise<void> {
    // Do not start a cloud request while offline.
    if (this.provider() !== 'wiii' || this.destroyed || this.networkStatus.isEffectivelyOffline()) {
      return;
    }
    // Do not issue a second request if one is already in-flight (double-click guard).
    if (this.initInFlight()) {
      return;
    }

    this.loadError.set(false);
    this.embedUrl.set(null);
    this.offlineReconnectReady.set(false);
    this.initInFlight.set(true);

    const generation = ++this.initGeneration;

    try {
      const token = await this.tokenService.getToken();

      // Abort if destroyed or superseded while awaiting.
      if (this.destroyed || generation !== this.initGeneration) return;

      if (token) {
        const wiiiEmbedUrl = environment.wiiiEmbedUrl;
        if (!this.isTrustedCrossOriginEmbedUrl(wiiiEmbedUrl)) {
          this.loadError.set(true);
          return;
        }

        // Check again: we may have gone offline during the token exchange.
        if (this.networkStatus.isEffectivelyOffline()) {
          return;
        }

        const role = this.sessionService.currentRole() || 'student';
        // Org resolved by Wiii from connector config (SSOT) — no hardcoding needed
        const org = this.tokenService.organizationId() || '';
        const hash = `token=${token}&domain=maritime&theme=light&role=${role}&mode=widget&hide_welcome=true${org ? '&org=' + encodeURIComponent(org) : ''}`;
        const url = `${wiiiEmbedUrl}#${hash}`;
        this.embedUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      } else {
        this.loadError.set(true);
      }
    } catch {
      if (!this.destroyed && generation === this.initGeneration) {
        this.loadError.set(true);
      }
    } finally {
      // A superseded request must not release the lock owned by its replacement.
      if (generation === this.initGeneration) this.initInFlight.set(false);
    }
  }

  /** Manual retry — deliberate action, resets reconnect-ready flag. */
  retryInit(): void {
    this.offlineReconnectReady.set(false);
    this.initEmbed();
  }

  changeProvider(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'wiii' || value === 'chatgpt') this.selectProvider(value);
  }

  selectProvider(provider: 'wiii' | 'chatgpt'): void {
    if (provider === 'chatgpt' && !this.availability.chatgptEnabled()) return;
    this.initGeneration++;
    this.initInFlight.set(false);
    this.embedUrl.set(null);
    this.loadError.set(false);
    this.offlineReconnectReady.set(false);
    this.provider.set(provider);
    if (provider === 'wiii') this.initEmbed();
  }

  onClose(): void {
    this.closePanel.emit();
  }

  openFullWiii(): void {
    window.open(environment.wiiiAppUrl, '_blank');
  }

  /**
   * New Chat — sends PostMessage to Wiii embed to start a fresh conversation.
   * The old conversation is preserved in backend history (accessible from full Wiii app).
   * Only the sidebar view resets to show a clean welcome screen.
   */
  clearChat(): void {
    const wiiiOrigin = this.getEmbedOrigin();
    if (!wiiiOrigin) return;

    const iframe = this.wiiiIframe();
    iframe?.nativeElement.contentWindow?.postMessage(
      { type: 'wiii:clear-chat' },
      wiiiOrigin
    );
  }

  /**
   * PostMessage bridge — handles token refresh requests from Wiii embed.
   * When the AI JWT expires mid-conversation, the iframe sends 'wiii:auth-expired'
   * and we respond with a fresh token.
   *
   * Security: messages are only accepted from the exact Wiii embed origin.
   * A window claiming a trusted origin via event.origin spoofing is not possible
   * in the browser security model, but we additionally validate the origin string
   * is a known cross-origin to prevent same-origin privilege escalation.
   */
  private setupMessageBridge(): void {
    const wiiiOrigin = this.getEmbedOrigin();
    if (!wiiiOrigin) return;

    this.messageHandler = async (event: MessageEvent) => {
      // Origin validation — only accept messages from the exact Wiii embed origin.
      // event.origin is set by the browser; a page cannot spoof it.
      // We also reject same-origin messages via isTrustedCrossOrigin to prevent a
      // rogue same-domain window from impersonating the Wiii embed.
      if (event.origin !== wiiiOrigin) return;

      // Source validation — reject messages from any window other than the known
      // iframe's contentWindow. event.source is the actual sending Window reference;
      // even if an attacker matches the origin string, they cannot match this reference.
      // Also reject when no iframe is mounted (wiiiIframe is null) — a message
      // claiming the Wiii origin when no embed is active has no legitimate sender.
      const iframeRef = this.wiiiIframe();
      if (!iframeRef) return;
      if (event.source !== iframeRef.nativeElement.contentWindow) return;

      if (event.data?.type === 'wiii:auth-expired') {
        // Deduplicate: if a refresh is already in-flight, ignore the duplicate event.
        if (this.refreshPending) return;
        // Do not refresh while offline — it will fail anyway and generate noise.
        if (this.networkStatus.isEffectivelyOffline()) return;

        this.refreshPending = true;
        // Snapshot the iframe reference and generation before awaiting. After
        // the await, verify the same iframe is still mounted to prevent a
        // replaced iframe from receiving a stale token.
        const senderWindow = iframeRef.nativeElement.contentWindow;
        const refreshGeneration = this.initGeneration;
        try {
          this.tokenService.clearToken();
          const token = await this.tokenService.getToken();
          if (this.destroyed) return;
          // Reject if the iframe was replaced while the refresh was in-flight.
          // Check both generation (a new init ran) and the live contentWindow
          // (same generation but iframe was remounted).
          if (this.initGeneration !== refreshGeneration) return;
          if (this.wiiiIframe()?.nativeElement.contentWindow !== senderWindow) return;
          if (token && senderWindow) {
            // Do NOT print or log the token.
            senderWindow.postMessage(
              { type: 'wiii:auth', payload: { token } },
              wiiiOrigin
            );
          }
        } finally {
          this.refreshPending = false;
        }
      }
    };

    window.addEventListener('message', this.messageHandler);
  }

  private getEmbedOrigin(): string | null {
    try {
      const origin = new URL(environment.wiiiEmbedUrl).origin;
      return this.isTrustedCrossOrigin(origin) ? origin : null;
    } catch {
      return null;
    }
  }

  private isTrustedCrossOriginEmbedUrl(rawUrl: string): boolean {
    try {
      return this.isTrustedCrossOrigin(new URL(rawUrl).origin);
    } catch {
      return false;
    }
  }

  private isTrustedCrossOrigin(origin: string): boolean {
    if (typeof window !== 'undefined' && origin === window.location.origin) {
      console.error(
        '[Wiii] Refusing same-origin iframe embed while sandbox allows scripts and same-origin.'
      );
      return false;
    }
    return true;
  }
}
