import { AiAvailabilityService } from '../../../application/services/ai-availability.service';
// Coordinator regression: a stale initialization must not strand manual recovery.
import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ChatPanelComponent } from './chat-panel.component';
import { AiTokenService } from '../../../infrastructure/api/ai-token.service';
import { SessionManagementService } from '../../../application/services/session-management.service';
import { WiiiContextService } from '../../../infrastructure/api/wiii-context.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { NetworkStatusService } from '../../../../../core/services/network-status.service';

describe('ChatPanelComponent interrupted initialization recovery', () => {
  it('keeps the newer initialization locked when the superseded request settles', fakeAsync(() => {
    const online = signal(true);
    let resolveOld!: (token: string | null) => void;
    let resolveNew!: (token: string | null) => void;
    const oldRequest = new Promise<string | null>(resolve => { resolveOld = resolve; });
    const newRequest = new Promise<string | null>(resolve => { resolveNew = resolve; });
    const getToken = jasmine.createSpy('getToken').and.returnValues(oldRequest, newRequest, newRequest);
    TestBed.configureTestingModule({
      imports: [ChatPanelComponent],
      providers: [
        { provide: AiAvailabilityService, useValue: { chatgptEnabled: signal(false), wiiiAvailable: signal(true), localSupported: signal(true) } },
        { provide: NetworkStatusService, useValue: { online, isEffectivelyOffline: () => !online() } },
        { provide: AiTokenService, useValue: { getToken, clearToken: () => {}, organizationId: () => null } },
        { provide: SessionManagementService, useValue: { currentRole: () => 'student' } },
        { provide: WiiiContextService, useValue: { connectIframe: () => {}, disconnectIframe: () => {} } },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 'qa-fixture', role: 'student' }) } },
      ],
    });
    const fixture = TestBed.createComponent(ChatPanelComponent);
    fixture.detectChanges();
    online.set(false);
    fixture.detectChanges();
    online.set(true);
    fixture.detectChanges();
    fixture.componentInstance.retryInit();
    expect(getToken).toHaveBeenCalledTimes(2);
    resolveOld('old-token');
    flushMicrotasks();
    fixture.detectChanges();
    fixture.componentInstance.retryInit();
    expect(getToken).withContext('old finally must not release the new request lock').toHaveBeenCalledTimes(2);
    resolveNew('new-token');
    flushMicrotasks();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('iframe')).not.toBeNull();
    fixture.destroy();
  }));

  it('discards the old response, offers retry and completes a new initialization', fakeAsync(() => {
    const online = signal(true);
    let resolveOld!: (token: string | null) => void;
    const oldRequest = new Promise<string | null>(resolve => { resolveOld = resolve; });
    const getToken = jasmine.createSpy('getToken').and.returnValue(oldRequest);
    TestBed.configureTestingModule({
      imports: [ChatPanelComponent],
      providers: [
        { provide: AiAvailabilityService, useValue: { chatgptEnabled: signal(false), wiiiAvailable: signal(true), localSupported: signal(true) } },
        { provide: NetworkStatusService, useValue: { online, isEffectivelyOffline: () => !online() } },
        { provide: AiTokenService, useValue: { getToken, clearToken: () => {}, organizationId: () => null } },
        { provide: SessionManagementService, useValue: { currentRole: () => 'student' } },
        { provide: WiiiContextService, useValue: { connectIframe: () => {}, disconnectIframe: () => {} } },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 'qa-fixture', role: 'student' }) } },
      ],
    });
    const fixture = TestBed.createComponent(ChatPanelComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-state')).not.toBeNull();
    expect(getToken).toHaveBeenCalledTimes(1);
    online.set(false);
    fixture.detectChanges();
    tick();
    online.set(true);
    fixture.detectChanges();
    tick();
    resolveOld('old-fixture-token');
    flushMicrotasks();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
    const retry = fixture.nativeElement.querySelector('.retry-button') as HTMLButtonElement | null;
    expect(retry).withContext('reconnection must expose manual recovery').not.toBeNull();
    if (retry) {
      getToken.and.returnValue(Promise.resolve('new-fixture-token'));
      retry.click();
      flushMicrotasks();
      fixture.detectChanges();
      expect(getToken).toHaveBeenCalledTimes(2);
      expect(fixture.nativeElement.querySelector('iframe')).not.toBeNull();
    }
    fixture.destroy();
  }));
});
