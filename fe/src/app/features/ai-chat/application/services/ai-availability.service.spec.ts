import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { AiAvailabilityService } from './ai-availability.service';
import { ChatApiClient } from '../../infrastructure/api/chat-api.client';
import { ChatgptApiService } from '../../infrastructure/api/chatgpt-api.service';
import { NetworkStatusService } from '../../../../core/services/network-status.service';

describe('AiAvailabilityService independent providers', () => {
  function create(health: unknown, chatgpt: unknown, platform = 'browser', initiallyOnline = true, effectivelyOffline?: () => boolean) {
    const online = signal(initiallyOnline);
    TestBed.configureTestingModule({ providers: [
      { provide: PLATFORM_ID, useValue: platform },
      { provide: NetworkStatusService, useValue: { online, isEffectivelyOffline: effectivelyOffline ?? (() => !online()) } },
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

  it('keeps local setup reachable when cloud providers fail without probing the device', () => {
    const localFetch = spyOn(globalThis, 'fetch');
    const service = create(throwError(() => new Error('Offline')), throwError(() => new Error('Offline')));
    expect(service.isAvailable()).toBeFalse();
    expect(service.localSupported()).toBeTrue();
    expect(service.canOpenAssistant()).toBeTrue();
    expect(localFetch).not.toHaveBeenCalled();
  });

  it('does not advertise device-local capability during server rendering', () => {
    const service = create(throwError(() => new Error('Offline')), of({ enabled: false }), 'server');
    expect(service.localSupported()).toBeFalse();
    expect(service.canOpenAssistant()).toBeFalse();
  });

  it('skips cloud discovery when opened offline, then refreshes only availability on reconnection', () => {
    const health = new Subject();
    const chatgpt = new Subject();
    const service = create(health, chatgpt, 'browser', false);
    TestBed.flushEffects();
    expect(health.observed).toBeFalse();
    expect(chatgpt.observed).toBeFalse();
    expect(service.canOpenAssistant()).toBeTrue();
    TestBed.inject(NetworkStatusService).online.set(true);
    TestBed.flushEffects();
    expect(health.observed).toBeTrue();
    expect(chatgpt.observed).toBeTrue();
    chatgpt.next({ enabled: true, status: 'disconnected' });
    expect(service.chatgptEnabled()).toBeTrue();
  });

  it('recovers skipped discovery after a browser online event without a debounced signal transition', () => {
    let effectivelyOffline = true;
    const health = new Subject();
    const chatgpt = new Subject();
    const service = create(health, chatgpt, 'browser', true, () => effectivelyOffline);
    TestBed.flushEffects();
    expect(health.observed).toBeFalse();
    expect(chatgpt.observed).toBeFalse();
    effectivelyOffline = false;
    window.dispatchEvent(new Event('online'));
    TestBed.flushEffects();
    expect(health.observed).toBeTrue();
    expect(chatgpt.observed).toBeTrue();
    chatgpt.next({ enabled: true, status: 'disconnected' });
    expect(service.chatgptEnabled()).toBeTrue();
  });

  it('refreshes only once when browser and debounced signal recover together', () => {
    create(new Subject(), new Subject(), 'browser', false);
    TestBed.flushEffects();
    const health = spyOn(TestBed.inject(ChatApiClient), 'checkHealth').and.callThrough();
    const chatgpt = spyOn(TestBed.inject(ChatgptApiService), 'status').and.callThrough();
    TestBed.inject(NetworkStatusService).online.set(true);
    window.dispatchEvent(new Event('online'));
    TestBed.flushEffects();
    expect(health).toHaveBeenCalledTimes(1);
    expect(chatgpt).toHaveBeenCalledTimes(1);
  });

  it('does not discover providers after its lifecycle ends', () => {
    let effectivelyOffline = true;
    const health = new Subject();
    const chatgpt = new Subject();
    create(health, chatgpt, 'browser', true, () => effectivelyOffline);
    TestBed.flushEffects();
    TestBed.resetTestingModule();
    effectivelyOffline = false;
    window.dispatchEvent(new Event('online'));
    expect(health.observed).toBeFalse();
    expect(chatgpt.observed).toBeFalse();
  });
});
