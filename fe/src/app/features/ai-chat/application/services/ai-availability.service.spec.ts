import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AiAvailabilityService } from './ai-availability.service';
import { ChatApiClient } from '../../infrastructure/api/chat-api.client';
import { ChatgptApiService } from '../../infrastructure/api/chatgpt-api.service';

describe('AiAvailabilityService independent providers', () => {
  function create(health: unknown, chatgpt: unknown) {
    TestBed.configureTestingModule({ providers: [
      { provide: ChatApiClient, useValue: { checkHealth: () => health } },
      { provide: ChatgptApiService, useValue: { status: () => chatgpt } },
    ] });
    return TestBed.inject(AiAvailabilityService);
  }

  it('enables ChatGPT while Wiii is unavailable', () => {
    const service = create(throwError(() => new Error('Wiii offline')), of({ enabled: true, status: 'disconnected' }));
    expect(service.isAvailable()).toBeTrue();
    expect(service.wiiiAvailable()).toBeFalse();
    expect(service.chatgptEnabled()).toBeTrue();
  });

  it('does not wait for Wiii health when ChatGPT is available', () => {
    const service = create(new Subject(), of({ enabled: true, status: 'disconnected' }));
    expect(service.status()).toBe('available');
    expect(service.hasResolved()).toBeTrue();
  });

  it('does not expose a disabled provider if Wiii is also unavailable', () => {
    const service = create(throwError(() => new Error('Wiii offline')), of({ enabled: false, status: 'disconnected' }));
    expect(service.status()).toBe('unavailable');
    expect(service.isAvailable()).toBeFalse();
  });

  it('retains Wiii when ChatGPT is disabled or its status endpoint fails', () => {
    const service = create(of({ status: 'healthy', aiServiceStatus: 'configured' }), throwError(() => new Error('Disabled endpoint')));
    expect(service.isAvailable()).toBeTrue();
    expect(service.wiiiAvailable()).toBeTrue();
    expect(service.chatgptEnabled()).toBeFalse();
  });
});
