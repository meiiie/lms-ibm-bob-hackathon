import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, of } from 'rxjs';
import { ChatgptApiService } from './chatgpt-api.service';
import { errorInterceptor } from '../../../../api/interceptors/error.interceptor';
import { authInterceptor } from '../../../../api/interceptors/auth.interceptor';
import { AuthService } from '../../../../core/services/auth.service';
import { NetworkStatusService } from '../../../../core/services/network-status.service';
import { SessionExpiredService } from '../../../../core/services/session-expired.service';

describe('ChatgptApiService with LMS HTTP interceptors', () => {
  let api: ChatgptApiService;
  let http: HttpTestingController;
  let auth: { getToken: () => string; refreshToken: jasmine.Spy; logout: jasmine.Spy };

  beforeEach(() => {
    auth = {
      getToken: () => 'fixture-lms-access-token',
      refreshToken: jasmine.createSpy('refreshToken').and.returnValue(of({ accessToken: 'fixture-refreshed' })),
      logout: jasmine.createSpy('logout'),
    };
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: auth },
      { provide: NetworkStatusService, useValue: { online: () => true, hasRecentOfflineSignal: () => false } },
      { provide: SessionExpiredService, useValue: { transitionToAuthenticated: () => {}, transitionToDegraded: () => {} } },
    ] });
    api = TestBed.inject(ChatgptApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('does not automatically replay any ChatGPT mutation after a server failure', fakeAsync(() => {
    const operations: { path: string; run: () => Observable<unknown>; method: string; body: unknown }[] = [
      { path: '/device', run: () => api.start(), method: 'POST', body: {} },
      { path: '/poll', run: () => api.poll('fixture-attempt'), method: 'POST', body: { attemptId: 'fixture-attempt' } },
      { path: '/ask', run: () => api.ask('A short question'), method: 'POST', body: { question: 'A short question' } },
      { path: '/connection', run: () => api.disconnect(), method: 'DELETE', body: null },
    ];
    for (const operation of operations) {
      let failed = false;
      operation.run().subscribe({ error: () => { failed = true; } });
      const request = http.expectOne(req => req.url.endsWith(`/api/v3/ai/chatgpt${operation.path}`));
      expect(request.request.method).toBe(operation.method);
      expect(request.request.body).toEqual(operation.body);
      expect(request.request.headers.get('Authorization')).toBe('Bearer fixture-lms-access-token');
      request.flush({ error: { code: 'unavailable' } }, { status: 503, statusText: 'Unavailable' });
      tick(5000);
      expect(failed).toBeTrue();
      http.expectNone(req => req.url.includes('/api/v3/ai/chatgpt/'));
    }
  }));

  it('does not refresh LMS auth and replay a ChatGPT question on 401', fakeAsync(() => {
    api.ask('A question').subscribe({ error: () => {} });
    http.expectOne(req => req.url.endsWith('/chatgpt/ask'))
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    tick(5000);
    expect(auth.refreshToken).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
    http.expectNone(req => req.url.includes('/api/v3/ai/chatgpt/'));
  }));

  it('does not retry provider unauthorized conflicts', fakeAsync(() => {
    api.ask('A question').subscribe({ error: () => {} });
    http.expectOne(req => req.url.endsWith('/chatgpt/ask'))
      .flush({ error: { code: 'unauthorized' } }, { status: 409, statusText: 'Conflict' });
    tick(5000);
    expect(auth.refreshToken).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
    http.expectNone(req => req.url.includes('/api/v3/ai/chatgpt/'));
  }));
});
