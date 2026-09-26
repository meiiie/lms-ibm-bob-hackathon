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

describe('ChatPanel provider integration (mock APIs)', () => {
  const create = (wiiiAvailable: boolean) => {
    const availability = { wiiiAvailable: signal(wiiiAvailable), chatgptEnabled: signal(true) };
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
        { provide: AiTokenService, useValue: token },
        { provide: NetworkStatusService, useValue: { online: signal(true), isEffectivelyOffline: () => false } },
        { provide: SessionManagementService, useValue: { currentRole: () => 'student' } },
        { provide: WiiiContextService, useValue: { connectIframe: () => {}, disconnectIframe: () => {} } },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 'fixture-student' }) } },
      ],
    });
    return { fixture: TestBed.createComponent(ChatPanelComponent), token, chatgpt, availability };
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
