import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ChatPanelComponent } from './chat-panel.component';
import { AiAvailabilityService } from '../../../application/services/ai-availability.service';
import { ChatgptApiService } from '../../../infrastructure/api/chatgpt-api.service';
import { AiTokenService } from '../../../infrastructure/api/ai-token.service';
import { SessionManagementService } from '../../../application/services/session-management.service';
import { WiiiContextService } from '../../../infrastructure/api/wiii-context.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { NetworkStatusService } from '../../../../../core/services/network-status.service';
import { LocalModelApiService } from '../../../infrastructure/api/local-model-api.service';

describe('ChatPanel provider integration (mock APIs)', () => {
  const create = (wiiiAvailable: boolean, chatgptEnabled = true, isOnline = true) => {
    const availability = { wiiiAvailable: signal(wiiiAvailable), chatgptEnabled: signal(chatgptEnabled), localSupported: signal(true) };
    const local = jasmine.createSpyObj('LocalModelApiService', ['discover', 'ask']);
    const online = signal(isOnline);
    const token = { getToken: jasmine.createSpy('getToken').and.resolveTo(null), clearToken: () => {}, organizationId: () => null };
    const chatgpt = jasmine.createSpyObj('ChatgptApiService', ['status', 'start', 'poll']);
    chatgpt.status.and.returnValue(of({ enabled: true, status: 'disconnected' }));
    chatgpt.start.and.returnValue(of({
      enabled: true, status: 'pending', attemptId: 'fixture-attempt', userCode: 'TEST-CODE',
      verificationUri: 'https://auth.openai.com/codex/device', intervalSeconds: 5,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }));
    TestBed.configureTestingModule({
      imports: [ChatPanelComponent],
      providers: [
        { provide: AiAvailabilityService, useValue: availability },
        { provide: ChatgptApiService, useValue: chatgpt },
        { provide: LocalModelApiService, useValue: local },
        { provide: AiTokenService, useValue: token },
        { provide: NetworkStatusService, useValue: { online, isEffectivelyOffline: () => !online() } },
        { provide: SessionManagementService, useValue: { currentRole: () => 'student' } },
        { provide: WiiiContextService, useValue: { connectIframe: () => {}, disconnectIframe: () => {} } },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 'fixture-student' }) } },
      ],
    });
    return { fixture: TestBed.createComponent(ChatPanelComponent), token, chatgpt, local, availability, online };
  };

  it('opens ChatGPT without any Wiii token request when Wiii is unavailable', () => {
    const { fixture, token, chatgpt } = create(false);
    fixture.detectChanges();
    expect(fixture.componentInstance.provider()).toBe('chatgpt');
    expect(fixture.nativeElement.querySelector('app-chatgpt-panel')).not.toBeNull();
    expect(token.getToken).not.toHaveBeenCalled();
    expect(chatgpt.status).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('offers Local when cloud providers are unavailable without probing a local server', () => {
    const { fixture, token, chatgpt, local } = create(false, false);
    fixture.detectChanges();
    expect(fixture.componentInstance.provider()).toBe('local');
    expect(fixture.nativeElement.querySelector('app-local-model-panel')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('option[value="chatgpt"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('option[value="wiii"]').disabled).toBeTrue();
    expect(local.discover).not.toHaveBeenCalled();
    expect(token.getToken).not.toHaveBeenCalled();
    expect(chatgpt.status).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('keeps Local usable through the cloud offline gate', () => {
    const { fixture, local, token } = create(false, false, false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-local-model-panel')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.offline-state')).toBeNull();
    expect(local.discover).not.toHaveBeenCalled();
    expect(token.getToken).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('does not replace an active Local task when delayed cloud health becomes available', () => {
    const { fixture, availability, token } = create(false, false);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.provider-content').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    availability.wiiiAvailable.set(true);
    fixture.detectChanges();
    expect(fixture.componentInstance.provider()).toBe('local');
    expect(token.getToken).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('preserves a Local request started with a native click when cloud health arrives', () => {
    const { fixture, availability, local } = create(false, false);
    local.discover.and.returnValue(new Promise(() => {}));
    fixture.detectChanges();
    const check = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes('Check connection'))!;
    check.click();
    const requestSignal = local.discover.calls.mostRecent().args[1] as AbortSignal;
    availability.wiiiAvailable.set(true);
    fixture.detectChanges();
    expect(fixture.componentInstance.provider()).toBe('local');
    expect(fixture.nativeElement.querySelector('app-local-model-panel')).not.toBeNull();
    expect(requestSignal.aborted).toBeFalse();
    fixture.destroy();
  });

  it('preserves a Local draft entered with an input event when cloud health arrives', () => {
    const { fixture, availability } = create(false, false);
    fixture.detectChanges();
    const textarea = fixture.nativeElement.querySelector('#local-question') as HTMLTextAreaElement;
    textarea.value = 'Explain buoyancy';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    availability.wiiiAvailable.set(true);
    fixture.detectChanges();
    expect(fixture.componentInstance.provider()).toBe('local');
    expect(fixture.nativeElement.querySelector('#local-question')?.value).toBe('Explain buoyancy');
    fixture.destroy();
  });

  it('cancels ChatGPT polling on a provider switch', fakeAsync(() => {
    const { fixture, chatgpt } = create(true);
    fixture.detectChanges();
    flushMicrotasks();
    fixture.componentInstance.selectProvider('chatgpt');
    fixture.detectChanges();
    const connect = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes('Connect ChatGPT'))!;
    connect.click();
    fixture.detectChanges();
    fixture.componentInstance.selectProvider('wiii');
    fixture.detectChanges();
    tick(6000);
    expect(chatgpt.poll).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-chatgpt-panel')).toBeNull();
    fixture.destroy();
  }));
});
