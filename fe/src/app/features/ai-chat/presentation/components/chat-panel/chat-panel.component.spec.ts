/**
 * ChatPanelComponent — offline-safe sidebar tests
 *
 * Covers:
 *  1. Offline open: offline state shown, no token exchange, panel closable
 *  2. Loss during pending init: stale async result is discarded (offline mid-init)
 *  3. Reconnection: retry button appears in its own block after restore, no auto-loop
 *  4. Teardown: destroyed flag prevents commit after ngOnDestroy
 *  5. Online integration: loading state only, reconnect must NOT appear during init
 *  6. Origin/source security: missing iframe rejects all auth-expired, wrong-source rejected
 *  7. Double-click: exactly ONE getToken call (in-flight guard blocks second)
 */
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
  flushMicrotasks,
} from '@angular/core/testing';
import { signal } from '@angular/core';

import { AiTokenService } from '../../../infrastructure/api/ai-token.service';
import { SessionManagementService } from '../../../application/services/session-management.service';
import { WiiiContextService } from '../../../infrastructure/api/wiii-context.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { NetworkStatusService } from '../../../../../core/services/network-status.service';
import { ChatPanelComponent } from './chat-panel.component';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNetworkStatus(online: boolean) {
  const onlineSignal = signal(online);
  return {
    online: onlineSignal,
    isEffectivelyOffline: () => !onlineSignal(),
  };
}

/**
 * Create a token service whose promise resolves only when _resolve() is called.
 * Pass immediateValue to resolve synchronously on construction.
 */
function makeDeferredTokenService(immediateValue?: string | null) {
  let resolve!: (v: string | null) => void;
  const promise = new Promise<string | null>((res) => {
    resolve = res;
  });
  if (immediateValue !== undefined) {
    resolve(immediateValue);
  }
  return {
    _resolve: (v: string | null) => resolve(v),
    _promise: promise,
    getToken: jasmine.createSpy('getToken').and.returnValue(promise),
    clearToken: jasmine.createSpy('clearToken'),
    organizationId: jasmine.createSpy('organizationId').and.returnValue('org-test'),
  };
}

function baseProviders(
  network: ReturnType<typeof makeNetworkStatus>,
  token: ReturnType<typeof makeDeferredTokenService>,
) {
  return [
    { provide: NetworkStatusService, useValue: network },
    { provide: AiTokenService, useValue: token },
    {
      provide: SessionManagementService,
      useValue: { currentRole: () => 'student' },
    },
    {
      provide: WiiiContextService,
      useValue: {
        connectIframe: jasmine.createSpy('connectIframe'),
        disconnectIframe: jasmine.createSpy('disconnectIframe'),
      },
    },
    {
      provide: AuthService,
      useValue: { currentUser: () => ({ id: 'u1', role: 'student' }) },
    },
  ];
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ChatPanelComponent — offline safety', () => {

  // -------------------------------------------------------------------------
  // 1. Opening sidebar while offline
  // -------------------------------------------------------------------------
  describe('1. opening while offline', () => {
    let fixture: ComponentFixture<ChatPanelComponent>;
    let network: ReturnType<typeof makeNetworkStatus>;
    let tokenSvc: ReturnType<typeof makeDeferredTokenService>;

    beforeEach(async () => {
      network = makeNetworkStatus(false);
      tokenSvc = makeDeferredTokenService(null); // resolves immediately with null

      await TestBed.configureTestingModule({
        imports: [ChatPanelComponent],
        providers: baseProviders(network, tokenSvc),
      }).compileComponents();

      fixture = TestBed.createComponent(ChatPanelComponent);
      fixture.detectChanges();
    });

    afterEach(() => fixture.destroy());

    it('displays the offline state element', () => {
      expect(fixture.nativeElement.querySelector('.offline-state')).not.toBeNull();
    });

    it('shows guidance text mentioning downloaded lessons', () => {
      const guidance = fixture.nativeElement.querySelector('.offline-guidance') as HTMLElement;
      expect(guidance).not.toBeNull();
      expect(guidance.textContent).toContain('bài học đã tải về');
    });

    it('does not render the loading state', () => {
      expect(fixture.nativeElement.querySelector('.loading-state')).toBeNull();
    });

    it('does not render an iframe', () => {
      expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
    });

    it('does not call getToken', () => {
      expect(tokenSvc.getToken).not.toHaveBeenCalled();
    });

    it('panel can still be closed (close button accessible)', () => {
      const closeBtn = fixture.nativeElement.querySelector(
        '[aria-label="Đóng trợ lý AI"]',
      ) as HTMLButtonElement;
      expect(closeBtn).not.toBeNull();

      const emitSpy = jasmine.createSpy('closePanel');
      fixture.componentInstance.closePanel.subscribe(emitSpy);
      closeBtn.click();
      expect(emitSpy).toHaveBeenCalled();
    });

    it('offline state element has role=status for screen-reader announcement', () => {
      const el = fixture.nativeElement.querySelector('.offline-state') as HTMLElement;
      expect(el.getAttribute('role')).toBe('status');
    });

    it('retry button is NOT shown while still offline', () => {
      expect(fixture.nativeElement.querySelector('.retry-button')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Connectivity lost during pending init
  // -------------------------------------------------------------------------
  describe('2. going offline during pending token exchange', () => {
    let fixture: ComponentFixture<ChatPanelComponent>;
    let network: ReturnType<typeof makeNetworkStatus>;
    let tokenSvc: ReturnType<typeof makeDeferredTokenService>;

    beforeEach(async () => {
      // Start online so initEmbed fires, but delay token resolution
      network = makeNetworkStatus(true);
      tokenSvc = makeDeferredTokenService(); // no immediate value — stays pending

      await TestBed.configureTestingModule({
        imports: [ChatPanelComponent],
        providers: baseProviders(network, tokenSvc),
      }).compileComponents();

      fixture = TestBed.createComponent(ChatPanelComponent);
      fixture.detectChanges(); // ngOnInit → initEmbed starts, awaiting getToken
    });

    afterEach(() => fixture.destroy());

    it('shows loading state while token is pending (online)', () => {
      expect(fixture.nativeElement.querySelector('.loading-state')).not.toBeNull();
    });

    it('offline mid-init: generation is invalidated, iframe NOT mounted when token resolves', fakeAsync(() => {
      // Simulate going offline while token exchange is in-flight
      network.online.set(false);
      fixture.detectChanges();

      // Resolve token after going offline — our generation check must discard it
      tokenSvc._resolve('tok-123');
      flushMicrotasks();
      tick();
      fixture.detectChanges();

      // The offline effect incremented initGeneration, so the in-flight call's
      // generation check fails. embedUrl must not be set; offline state shown.
      expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
      expect(fixture.nativeElement.querySelector('.offline-state')).not.toBeNull();
    }));

    it('offline mid-init: stale embedUrl is cleared by the offline effect', fakeAsync(() => {
      network.online.set(false);
      fixture.detectChanges();
      tokenSvc._resolve('tok-stale');
      flushMicrotasks();
      tick();
      fixture.detectChanges();

      expect(fixture.componentInstance.embedUrl()).toBeNull();
    }));

    it('offline mid-init: no error state shown while offline', fakeAsync(() => {
      network.online.set(false);
      fixture.detectChanges();
      tokenSvc._resolve(null); // would have set loadError if not discarded
      flushMicrotasks();
      tick();
      fixture.detectChanges();

      // Offline state overrides everything; error must not appear
      expect(fixture.nativeElement.querySelector('.error-state')).toBeNull();
      expect(fixture.nativeElement.querySelector('.offline-state')).not.toBeNull();
    }));
  });

  // -------------------------------------------------------------------------
  // 3. Reconnection — retry button appears outside offline block, no auto-loop
  // -------------------------------------------------------------------------
  describe('3. reconnection after being opened offline', () => {
    let fixture: ComponentFixture<ChatPanelComponent>;
    let network: ReturnType<typeof makeNetworkStatus>;
    let tokenSvc: ReturnType<typeof makeDeferredTokenService>;

    beforeEach(async () => {
      network = makeNetworkStatus(false); // open offline
      tokenSvc = makeDeferredTokenService(); // stays pending until resolved

      await TestBed.configureTestingModule({
        imports: [ChatPanelComponent],
        providers: baseProviders(network, tokenSvc),
      }).compileComponents();

      fixture = TestBed.createComponent(ChatPanelComponent);
      fixture.detectChanges();
    });

    afterEach(() => fixture.destroy());

    it('retry button appears in a separate block once connectivity restores', fakeAsync(() => {
      // Still offline initially — no retry button
      expect(fixture.nativeElement.querySelector('.retry-button')).toBeNull();

      // Simulate reconnection
      network.online.set(true);
      tick(); // allow effects to run
      fixture.detectChanges();

      // Retry button is now shown (it lives outside @if(isOffline()))
      const retryBtn = fixture.nativeElement.querySelector('.retry-button');
      expect(retryBtn).not.toBeNull();
    }));

    it('offline state div is hidden once online (isOffline() = false)', fakeAsync(() => {
      network.online.set(true);
      tick();
      fixture.detectChanges();

      // The reconnect-ready block shows; offline state with lesson guidance is hidden
      const guidance = fixture.nativeElement.querySelector('.offline-guidance') as HTMLElement | null;
      if (guidance) {
        // If any guidance text is shown, it must be the reconnect message, not the offline one
        expect(guidance.textContent).not.toContain('bài học đã tải về');
      }
    }));

    it('clicking retry calls initEmbed exactly once', fakeAsync(() => {
      network.online.set(true);
      tick();
      fixture.detectChanges();

      tokenSvc.getToken.calls.reset();
      const retryBtn = fixture.nativeElement.querySelector('.retry-button') as HTMLButtonElement;
      retryBtn.click();
      flushMicrotasks();
      tick();
      fixture.detectChanges();

      // Called exactly once — no automatic retry loop
      expect(tokenSvc.getToken).toHaveBeenCalledTimes(1);

      tokenSvc._resolve(null);
      flushMicrotasks();
      tick();
    }));

    it('retry button disappears immediately after click (offlineReconnectReady reset)', fakeAsync(() => {
      network.online.set(true);
      tick();
      fixture.detectChanges();

      const retryBtn = fixture.nativeElement.querySelector('.retry-button') as HTMLButtonElement;
      retryBtn.click();
      fixture.detectChanges();

      // offlineReconnectReady was reset, so the reconnect-ready block is gone.
      // While online and pending: shows loading, no retry button.
      expect(fixture.nativeElement.querySelector('.retry-button')).toBeNull();
      expect(fixture.nativeElement.querySelector('.loading-state')).not.toBeNull();

      tokenSvc._resolve(null);
      flushMicrotasks();
      tick();
    }));
  });

  // -------------------------------------------------------------------------
  // 4. Teardown — destroyed flag prevents stale commit
  // -------------------------------------------------------------------------
  describe('4. teardown safety', () => {
    let fixture: ComponentFixture<ChatPanelComponent>;
    let network: ReturnType<typeof makeNetworkStatus>;
    let tokenSvc: ReturnType<typeof makeDeferredTokenService>;

    beforeEach(async () => {
      network = makeNetworkStatus(true);
      tokenSvc = makeDeferredTokenService(); // stays pending

      await TestBed.configureTestingModule({
        imports: [ChatPanelComponent],
        providers: baseProviders(network, tokenSvc),
      }).compileComponents();

      fixture = TestBed.createComponent(ChatPanelComponent);
      fixture.detectChanges();
    });

    it('destroys cleanly while token exchange is in-flight', fakeAsync(() => {
      fixture.destroy();

      // Resolve token after destroy — must not throw or commit state
      tokenSvc._resolve('tok-after-destroy');
      flushMicrotasks();
      tick();

      // No exception thrown = pass.
      expect(true).toBeTrue();
    }));

    it('removeEventListener for message is called on destroy', fakeAsync(() => {
      const removeSpy = spyOn(window, 'removeEventListener').and.callThrough();
      fixture.destroy();
      flushMicrotasks();
      const calls = removeSpy.calls.all().filter((c) => c.args[0] === 'message');
      expect(calls.length).toBeGreaterThanOrEqual(1);
    }));
  });

  // -------------------------------------------------------------------------
  // 5. Online integration — loading state, reconnect must NOT appear during init
  // -------------------------------------------------------------------------
  describe('5. online: normal embed flow', () => {
    let fixture: ComponentFixture<ChatPanelComponent>;
    let network: ReturnType<typeof makeNetworkStatus>;
    let tokenSvc: ReturnType<typeof makeDeferredTokenService>;

    beforeEach(async () => {
      network = makeNetworkStatus(true);
      tokenSvc = makeDeferredTokenService(); // stays pending initially

      await TestBed.configureTestingModule({
        imports: [ChatPanelComponent],
        providers: baseProviders(network, tokenSvc),
      }).compileComponents();

      fixture = TestBed.createComponent(ChatPanelComponent);
      fixture.detectChanges();
    });

    afterEach(() => fixture.destroy());

    it('shows loading state (not offline state) while token is pending', () => {
      expect(fixture.nativeElement.querySelector('.loading-state')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.offline-state')).toBeNull();
    });

    it('reconnect-ready state must NOT appear during ordinary online initialization', fakeAsync(() => {
      // While initInFlight=true, the restore effect must not set offlineReconnectReady.
      // Simulate the online signal firing while init is in progress.
      network.online.set(false);
      tick();
      network.online.set(true);
      tick();
      fixture.detectChanges();

      // online=true, embedUrl=null, loadError=false — but initInFlight prevents reconnect
      expect(fixture.nativeElement.querySelector('.retry-button')).toBeNull();
      expect(fixture.nativeElement.querySelector('.loading-state')).not.toBeNull();

      tokenSvc._resolve(null);
      flushMicrotasks();
      tick();
    }));

    it('calls getToken on init when online', fakeAsync(() => {
      flushMicrotasks();
      tick();
      expect(tokenSvc.getToken).toHaveBeenCalledTimes(1);
    }));

    it('shows error state (not loading or iframe) when token exchange returns null', fakeAsync(() => {
      tokenSvc._resolve(null);
      flushMicrotasks();
      tick();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.error-state')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.offline-state')).toBeNull();
      expect(fixture.nativeElement.querySelector('.loading-state')).toBeNull();
    }));
  });

  // -------------------------------------------------------------------------
  // 6. Origin/source security
  // -------------------------------------------------------------------------
  describe('6. origin/source security', () => {
    let fixture: ComponentFixture<ChatPanelComponent>;
    let network: ReturnType<typeof makeNetworkStatus>;
    let tokenSvc: ReturnType<typeof makeDeferredTokenService>;

    beforeEach(async () => {
      network = makeNetworkStatus(true);
      tokenSvc = makeDeferredTokenService('valid-token');

      await TestBed.configureTestingModule({
        imports: [ChatPanelComponent],
        providers: baseProviders(network, tokenSvc),
      }).compileComponents();

      fixture = TestBed.createComponent(ChatPanelComponent);
      fixture.detectChanges();
    });

    afterEach(() => fixture.destroy());

    it('does not call clearToken when message comes from an attacker origin', fakeAsync(() => {
      flushMicrotasks();
      tick();
      tokenSvc.clearToken.calls.reset();

      const untrustedEvent = new MessageEvent('message', {
        origin: 'https://attacker.example.com',
        data: { type: 'wiii:auth-expired' },
      });
      window.dispatchEvent(untrustedEvent);
      flushMicrotasks();
      tick();

      expect(tokenSvc.clearToken).not.toHaveBeenCalled();
    }));

    it('does not call clearToken when no iframe is mounted (wiiiIframe is null)', fakeAsync(() => {
      // Component is online but token hasn't resolved yet, so no iframe is mounted.
      // With the new !iframeRef guard, ALL auth-expired messages must be rejected.
      flushMicrotasks();
      tick();
      tokenSvc.clearToken.calls.reset();

      // Message with correct origin but no iframe mounted
      const noIframeEvent = new MessageEvent('message', {
        origin: 'http://localhost:8000',
        data: { type: 'wiii:auth-expired' },
      });
      window.dispatchEvent(noIframeEvent);
      flushMicrotasks();
      tick();

      // Must be rejected because wiiiIframe() === null
      expect(tokenSvc.clearToken).not.toHaveBeenCalled();
    }));

    it('does not call clearToken when source window is not the iframe contentWindow', fakeAsync(() => {
      flushMicrotasks();
      tick();
      tokenSvc.clearToken.calls.reset();

      // A message from a different window (e.g., a popup) matching origin but wrong source
      const spoofedEvent = new MessageEvent('message', {
        origin: 'http://localhost:8000',
        data: { type: 'wiii:auth-expired' },
        source: window, // not the iframe's contentWindow
      });
      window.dispatchEvent(spoofedEvent);
      flushMicrotasks();
      tick();

      expect(tokenSvc.clearToken).not.toHaveBeenCalled();
    }));
  });

  // -------------------------------------------------------------------------
  // 7. Double-click retry — exactly ONE getToken call (in-flight guard)
  // -------------------------------------------------------------------------
  describe('7. double-click retry — exactly one request', () => {
    let fixture: ComponentFixture<ChatPanelComponent>;
    let network: ReturnType<typeof makeNetworkStatus>;
    let tokenSvc: ReturnType<typeof makeDeferredTokenService>;

    beforeEach(async () => {
      network = makeNetworkStatus(false); // open offline
      tokenSvc = makeDeferredTokenService(); // stays pending

      await TestBed.configureTestingModule({
        imports: [ChatPanelComponent],
        providers: baseProviders(network, tokenSvc),
      }).compileComponents();

      fixture = TestBed.createComponent(ChatPanelComponent);
      fixture.detectChanges();
    });

    afterEach(() => fixture.destroy());

    it('double-click issues exactly ONE getToken call (in-flight guard blocks second)', fakeAsync(() => {
      // Reconnect to surface the retry button
      network.online.set(true);
      tick();
      fixture.detectChanges();

      const retryBtn = fixture.nativeElement.querySelector('.retry-button') as HTMLButtonElement;
      expect(retryBtn).not.toBeNull();

      // Double-click: second click must be a no-op because initInFlight=true after first
      retryBtn.click();
      retryBtn.click();
      flushMicrotasks();

      // Exactly one request, not two
      expect(tokenSvc.getToken).toHaveBeenCalledTimes(1);

      // Cleanup
      tokenSvc._resolve(null);
      flushMicrotasks();
      tick();
    }));

    it('after the first retry completes, a second retry is allowed', fakeAsync(() => {
      network.online.set(true);
      tick();
      fixture.detectChanges();

      const retryBtn = fixture.nativeElement.querySelector('.retry-button') as HTMLButtonElement;

      // First retry
      retryBtn.click();
      tokenSvc._resolve(null); // resolves → loadError=true, initInFlight=false
      flushMicrotasks();
      tick();
      fixture.detectChanges();

      // Now click retry on the error state
      const errorRetryBtn = fixture.nativeElement.querySelector(
        '.error-state button',
      ) as HTMLButtonElement;
      expect(errorRetryBtn).not.toBeNull();

      // Second retry call must work
      const secondSvc = makeDeferredTokenService();
      // Override the spy to use a fresh promise for the second call
      (tokenSvc.getToken as jasmine.Spy).and.returnValue(secondSvc._promise);
      tokenSvc.getToken.calls.reset();

      errorRetryBtn.click();
      flushMicrotasks();

      expect(tokenSvc.getToken).toHaveBeenCalledTimes(1);

      secondSvc._resolve(null);
      flushMicrotasks();
      tick();
    }));
  });
});
