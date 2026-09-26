import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { ChatgptPanelComponent } from './chatgpt-panel.component';
import { ChatgptApiService, ChatgptStatus } from '../../../infrastructure/api/chatgpt-api.service';
import { NetworkStatusService } from '../../../../../core/services/network-status.service';

describe('ChatgptPanelComponent (mock provider)', () => {
  let fixture: ComponentFixture<ChatgptPanelComponent>;
  let component: ChatgptPanelComponent;
  let api: jasmine.SpyObj<ChatgptApiService>;
  let online: ReturnType<typeof signal<boolean>>;
  const disconnected: ChatgptStatus = { enabled: true, status: 'disconnected' };
  const connected: ChatgptStatus = { enabled: true, status: 'connected' };
  const pending = (): ChatgptStatus => ({
    enabled: true, status: 'pending', attemptId: 'opaque-fixture', userCode: 'TEST-1234',
    verificationUri: 'https://auth.openai.com/codex/device', intervalSeconds: 5,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });

  beforeEach(() => {
    online = signal(true);
    api = jasmine.createSpyObj('ChatgptApiService', ['status', 'start', 'poll', 'ask', 'disconnect']);
    api.status.and.returnValue(of(disconnected));
    api.start.and.callFake(() => of(pending()));
    api.poll.and.returnValue(of(connected));
    api.ask.and.returnValue(of({ answer: 'Fixture answer' }));
    api.disconnect.and.returnValue(of(disconnected));
    TestBed.configureTestingModule({
      imports: [ChatgptPanelComponent],
      providers: [
        { provide: ChatgptApiService, useValue: api },
        { provide: NetworkStatusService, useValue: { online, isEffectivelyOffline: () => !online() } },
      ],
    });
    fixture = TestBed.createComponent(ChatgptPanelComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('displays disabled state without offering connection', () => {
    api.status.and.returnValue(of({ enabled: false, status: 'disconnected' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('not enabled');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('requires device consent and polls only after the indicated interval', fakeAsync(() => {
    fixture.detectChanges();
    component.connect();
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.href).toBe('https://auth.openai.com/codex/device');
    expect(link.rel).toBe('noopener noreferrer');
    expect(fixture.nativeElement.textContent).toContain('TEST-1234');
    tick(4999);
    expect(api.poll).not.toHaveBeenCalled();
    tick(1);
    expect(api.poll).toHaveBeenCalledOnceWith('opaque-fixture');
    expect(component.connection()?.status).toBe('connected');
  }));

  it('guards duplicate connect and send clicks', () => {
    fixture.detectChanges();
    const start = new Subject<ChatgptStatus>();
    api.start.and.returnValue(start);
    component.connect();
    component.connect();
    expect(api.start).toHaveBeenCalledTimes(1);
    start.next(connected);
    const ask = new Subject<{ answer: string }>();
    api.ask.and.returnValue(ask);
    component.question.set('Explain buoyancy');
    component.send(new Event('submit'));
    component.send(new Event('submit'));
    expect(api.ask).toHaveBeenCalledOnceWith('Explain buoyancy');
  });

  it('renders response markup as plain text without storing a conversation', () => {
    api.status.and.returnValue(of(connected));
    api.ask.and.returnValue(of({ answer: '<img src=x onerror=alert(1)>\nA safe explanation.' }));
    fixture.detectChanges();
    component.question.set('My question');
    component.send(new Event('submit'));
    fixture.detectChanges();
    const answer = fixture.nativeElement.querySelector('[data-testid="chatgpt-answer"]') as HTMLElement;
    expect(answer.textContent).toContain('<img src=x');
    expect(answer.querySelector('img')).toBeNull();
    expect(component.question()).toBe('');
  });

  it('does not request status or start while offline', () => {
    online.set(false);
    fixture.detectChanges();
    component.connect();
    expect(api.status).not.toHaveBeenCalled();
    expect(api.start).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('internet connection');
  });

  it('cancels polling offline and requires manual recovery without replay', fakeAsync(() => {
    fixture.detectChanges();
    component.connect();
    online.set(false);
    fixture.detectChanges();
    tick(10_000);
    online.set(true);
    fixture.detectChanges();
    tick(10_000);
    expect(api.poll).not.toHaveBeenCalled();
    expect(api.start).toHaveBeenCalledTimes(1);
    expect(api.status).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Resume connection');
    component.resume();
    expect(api.status).toHaveBeenCalledTimes(2);
  }));

  it('offers recovery if a brief offline signal blocks polling before the online signal settles', fakeAsync(() => {
    fixture.detectChanges();
    component.connect();
    const network = TestBed.inject(NetworkStatusService);
    spyOn(network, 'isEffectivelyOffline').and.returnValue(true);
    tick(5000);
    expect(api.poll).not.toHaveBeenCalled();
    expect(component.needsResume()).toBeTrue();
  }));

  it('disconnect cancels a pending answer and clears text', () => {
    api.status.and.returnValue(of(connected));
    const answer = new Subject<{ answer: string }>();
    api.ask.and.returnValue(answer);
    fixture.detectChanges();
    component.question.set('A question');
    component.send(new Event('submit'));
    component.disconnect();
    answer.next({ answer: 'Stale secret answer' });
    expect(component.connection()?.status).toBe('disconnected');
    expect(component.question()).toBe('');
    expect(component.answer()).toBe('');
  });

  it('cancel disconnects a pending poll without resurrecting the connection', fakeAsync(() => {
    const poll = new Subject<ChatgptStatus>();
    api.poll.and.returnValue(poll);
    fixture.detectChanges();
    component.connect();
    tick(5000);
    component.disconnect();
    poll.next(connected);
    expect(component.connection()?.status).toBe('disconnected');
    expect(api.disconnect).toHaveBeenCalledTimes(1);
  }));

  it('teardown cancels timers and in-flight polling', fakeAsync(() => {
    fixture.detectChanges();
    component.connect();
    fixture.destroy();
    tick(6000);
    expect(api.poll).not.toHaveBeenCalled();
  }));

  it('expires pending authorization at the deadline', fakeAsync(() => {
    const state = { ...pending(), expiresAt: new Date(Date.now() + 2000).toISOString() };
    api.start.and.returnValue(of(state));
    fixture.detectChanges();
    component.connect();
    tick(2000);
    expect(component.connection()?.status).toBe('expired');
    expect(api.poll).not.toHaveBeenCalled();
  }));

  it('rejects an untrusted verification link and does not poll it', fakeAsync(() => {
    api.start.and.returnValue(of({ ...pending(), verificationUri: 'https://example.invalid/collect' }));
    fixture.detectChanges();
    component.connect();
    fixture.detectChanges();
    tick(6000);
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
    expect(api.poll).not.toHaveBeenCalled();
    expect(component.error()).toContain('verify');
  }));

  it('handles expired connection without exposing raw server errors', () => {
    api.status.and.returnValue(of(connected));
    api.ask.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401, error: { error: { code: 'expired', message: 'secret-token' } } })));
    fixture.detectChanges();
    component.question.set('A question');
    component.send(new Event('submit'));
    expect(component.connection()?.status).toBe('expired');
    expect(component.error()).toContain('expired');
    expect(component.error()).not.toContain('secret-token');
  });

  it('stops rate-limited polling until deliberate recovery', fakeAsync(() => {
    api.poll.and.returnValue(throwError(() => new HttpErrorResponse({ status: 429 })));
    fixture.detectChanges();
    component.connect();
    tick(20_000);
    expect(api.poll).toHaveBeenCalledTimes(1);
    expect(component.needsResume()).toBeTrue();
    expect(component.error()).toContain('rate limited');
  }));

  it('preserves a valid connection and question when the configured model is unsupported', fakeAsync(() => {
    api.status.and.returnValue(of(connected));
    api.ask.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { error: { code: 'model_not_supported', message: 'raw-provider-detail' } },
    })));
    fixture.detectChanges();
    component.question.set('Explain buoyancy');
    component.send(new Event('submit'));
    tick(10_000);
    fixture.detectChanges();
    expect(component.connection()?.status).toBe('connected');
    expect(component.question()).toBe('Explain buoyancy');
    expect(component.needsResume()).toBeFalse();
    expect(component.busy()).toBeFalse();
    expect(api.ask).toHaveBeenCalledOnceWith('Explain buoyancy');
    expect(api.start).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Ask the LMS administrator');
    expect(component.error()).not.toContain('raw-provider-detail');
  }));
});
