import {TestBed} from '@angular/core/testing';
import {Store} from '@ngrx/store';
import {of, toArray, firstValueFrom, Subject} from 'rxjs';
import {AuthService} from '../../auth_module';
import {ServiceProvider} from '../../roots';
import {LocalizationService} from '../normal-services/localization.service';
import {TurboService} from './turbo.service';

describe('Multilingual chat streaming', () => {
  it('omits generation settings even when legacy stored configuration contains them', () => {
    TestBed.configureTestingModule({providers: [
      {provide: Store, useValue: {select: () => of(null)}},
      {provide: ServiceProvider, useValue: {apiUrl: '/'}},
      {provide: AuthService, useValue: {token: 'test'}},
      {provide: LocalizationService, useValue: {requestLanguage: 'ja'}}
    ]});
    const service = TestBed.inject(TurboService);
    service.config = {
      model: {modelValue: 'gpt-5', vision: true},
      chatConfiguration: {temperature: 0.6, top_p: 0.6, max_completion_tokens: 4000,
        presence_penalty: 0.6, frequency_penalty: 0.6, reasoning_effort: 'high',
        verbosity: 'high', thinking_budget: 512, historySessionLength: 1, detail: 'high'}
    } as any;
    const send = spyOn(service, 'fetchChatBase').and.returnValue(of(''));
    const messages = [{role: 'user' as const, content: 'hello'}];
    service.fetchChat({messages} as any);
    expect(send).toHaveBeenCalledWith('/api/ai/chat', {
      messages, model: 'gpt-5', vision: true, stream: true
    });
  });
  it('preserves UTF-8 characters split between chunks and sends the language', async () => {
    TestBed.configureTestingModule({providers: [
      {provide: Store, useValue: {select: () => of(null)}},
      {provide: ServiceProvider, useValue: {apiUrl: '/'}},
      {provide: AuthService, useValue: {token: 'test'}},
      {provide: LocalizationService, useValue: {requestLanguage: 'ja'}}
    ]});
    const text = '你好、日本語🙂';
    const bytes = new TextEncoder().encode(`data: ${JSON.stringify({type: 'delta', text})}\n\ndata: {"type":"completed"}\n\n`);
    const stream = new ReadableStream<Uint8Array>({start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    }});
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response(stream, {headers: {'Content-Type': 'text/event-stream'}}));
    const chunks = await firstValueFrom(TestBed.inject(TurboService).fetchChatBase('/api/ai/chat', {model: 'test', messages: [{role: 'user', content: 'hello'}]}).pipe(toArray()));
    expect(chunks.join('')).toBe(text);
    expect((fetchSpy.calls.mostRecent().args[1]?.headers as Record<string, string>)['Accept-Language']).toBe('ja');
  });  it('does not restart a cancelled chat after token refresh completes', async () => {
    const refresh = new Subject<string>();
    const auth = {token: 'expired', refreshToken: 'refresh', refreshAccessToken: jasmine.createSpy().and.returnValue(refresh)};
    TestBed.configureTestingModule({providers: [
      {provide: Store, useValue: {select: () => of(null)}},
      {provide: ServiceProvider, useValue: {apiUrl: '/'}},
      {provide: AuthService, useValue: auth},
      {provide: LocalizationService, useValue: {requestLanguage: 'en'}}
    ]});
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response('', {status: 401}));
    const subscription = TestBed.inject(TurboService).fetchChatBase('/api/ai/chat', {model: 'test', messages: [{role: 'user', content: 'hello'}]}).subscribe();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(auth.refreshAccessToken).toHaveBeenCalled();
    subscription.unsubscribe();
    refresh.next('new-token');
    refresh.complete();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

});
