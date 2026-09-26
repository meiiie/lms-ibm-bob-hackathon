import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { LocalModelApiService, LocalModelError } from '../../../infrastructure/api/local-model-api.service';
import { LocalModelPanelComponent } from './local-model-panel.component';

describe('LocalModelPanelComponent (mock local runtime)', () => {
  let fixture: ComponentFixture<LocalModelPanelComponent>;
  let component: LocalModelPanelComponent;
  let api: jasmine.SpyObj<LocalModelApiService>;
  const event = (value: string) => ({ target: { value } }) as unknown as Event;

  beforeEach(() => {
    api = jasmine.createSpyObj('LocalModelApiService', ['discover', 'ask']);
    api.discover.and.resolveTo(['gemma3:4b']);
    api.ask.and.resolveTo('A local answer');
    TestBed.configureTestingModule({
      imports: [LocalModelPanelComponent], providers: [{ provide: LocalModelApiService, useValue: api }],
    });
    fixture = TestBed.createComponent(LocalModelPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => fixture.destroy());

  it('does not scan loopback on opening or changing the selected server', () => {
    expect(api.discover).not.toHaveBeenCalled();
    component.changeProvider(event('lmstudio'));
    expect(api.discover).not.toHaveBeenCalled();
    expect(api.ask).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('this device');
  });

  it('allows explicit local check and question while the browser reports no internet', fakeAsync(() => {
    spyOnProperty(navigator, 'onLine', 'get').and.returnValue(false);
    component.check();
    flushMicrotasks();
    expect(component.checked()).toBeTrue();
    component.question.set('Explain buoyancy');
    component.send(new Event('submit'));
    flushMicrotasks();
    expect(api.ask).toHaveBeenCalledOnceWith('ollama', 'gemma3:4b', 'Explain buoyancy', jasmine.any(AbortSignal));
    expect(component.answer()).toBe('A local answer');
  }));

  it('guards duplicate check and send clicks and renders the answer as plain text', fakeAsync(() => {
    component.check();
    component.check();
    flushMicrotasks();
    api.ask.and.resolveTo('<img src=x onerror=alert(1)>\nLocal explanation');
    component.question.set('Question');
    component.send(new Event('submit'));
    component.send(new Event('submit'));
    flushMicrotasks();
    fixture.detectChanges();
    expect(api.discover).toHaveBeenCalledTimes(1);
    expect(api.ask).toHaveBeenCalledTimes(1);
    const answer = fixture.nativeElement.querySelector('[data-testid="local-model-answer"]') as HTMLElement;
    expect(answer.textContent).toContain('<img src=x');
    expect(answer.querySelector('img')).toBeNull();
    expect(component.question()).toBe('');
  }));

  it('cancels a question, preserves its draft and ignores a stale answer', fakeAsync(() => {
    component.check();
    flushMicrotasks();
    let resolve!: (answer: string) => void;
    api.ask.and.returnValue(new Promise<string>(done => { resolve = done; }));
    component.question.set('Keep this draft');
    component.send(new Event('submit'));
    const signal = api.ask.calls.mostRecent().args[3];
    component.cancel();
    resolve('Late answer');
    flushMicrotasks();
    expect(signal.aborted).toBeTrue();
    expect(component.question()).toBe('Keep this draft');
    expect(component.answer()).toBe('');
    expect(component.busy()).toBeFalse();
    expect(component.notice()).toContain('Nothing will be resent');
    window.dispatchEvent(new Event('online'));
    tick(90_000);
    expect(api.ask).toHaveBeenCalledTimes(1);
  }));

  it('isolates replacement discovery from the cancelled previous server', fakeAsync(() => {
    let resolveOld!: (models: string[]) => void;
    let resolveNew!: (models: string[]) => void;
    api.discover.and.returnValues(new Promise<string[]>(done => { resolveOld = done; }),
      new Promise<string[]>(done => { resolveNew = done; }));
    component.check();
    const previousSignal = api.discover.calls.mostRecent().args[1];
    component.changeProvider(event('lmstudio'));
    component.check();
    resolveOld(['stale-model']);
    flushMicrotasks();
    expect(previousSignal.aborted).toBeTrue();
    expect(component.busy()).toBeTrue();
    expect(component.models()).toEqual([]);
    resolveNew(['current-model']);
    flushMicrotasks();
    expect(component.models()).toEqual(['current-model']);
    expect(component.provider()).toBe('lmstudio');
  }));

  it('shows CORS/local permission guidance on failure without fake connected state or retries', fakeAsync(() => {
    api.discover.and.rejectWith(new Error('private-server-details'));
    component.check();
    flushMicrotasks();
    fixture.detectChanges();
    expect(component.checked()).toBeFalse();
    expect(component.canSend()).toBeFalse();
    const alert = fixture.nativeElement.querySelector('[role="alert"]').textContent;
    expect(alert).toContain('CORS');
    expect(alert).toContain('local network access');
    expect(alert).not.toContain('private-server-details');
    tick(90_000);
    expect(api.discover).toHaveBeenCalledTimes(1);
  }));

  it('keeps the question after a timeout and requires explicit retry', fakeAsync(() => {
    component.check();
    flushMicrotasks();
    api.ask.and.rejectWith(new LocalModelError('timeout'));
    component.question.set('Explain buoyancy');
    component.send(new Event('submit'));
    flushMicrotasks();
    tick(90_000);
    expect(component.question()).toBe('Explain buoyancy');
    expect(component.error()).toContain('took too long');
    expect(api.ask).toHaveBeenCalledTimes(1);
  }));

  it('handles an empty local model list without enabling question submission', fakeAsync(() => {
    api.discover.and.resolveTo([]);
    component.check();
    flushMicrotasks();
    fixture.detectChanges();
    component.question.set('Question');
    expect(component.checked()).toBeTrue();
    expect(component.canSend()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('no eligible local models');
    component.send(new Event('submit'));
    expect(api.ask).not.toHaveBeenCalled();
  }));

  it('aborts work and clears text when the panel closes', fakeAsync(() => {
    let resolve!: (models: string[]) => void;
    api.discover.and.returnValue(new Promise<string[]>(done => { resolve = done; }));
    component.question.set('Private draft');
    component.check();
    const signal = api.discover.calls.mostRecent().args[1];
    fixture.destroy();
    resolve(['stale-model']);
    flushMicrotasks();
    expect(signal.aborted).toBeTrue();
    expect(component.question()).toBe('');
    expect(component.models()).toEqual([]);
    expect(component.checked()).toBeFalse();
  }));
});
