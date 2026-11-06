import {TestBed} from '@angular/core/testing';
import {Store} from '@ngrx/store';
import {of, toArray, firstValueFrom, Subject} from 'rxjs';
import {AuthService} from '../../auth_module';
import {ServiceProvider} from '../../roots';
import {LocalizationService} from '../normal-services/localization.service';
import {RelaxKonService} from './relaxkon.service';
import {ChatHistoryModel, ChatPacket} from '../../models';
import {ErrorType} from '../../errors';

describe('Multilingual chat streaming', () => {
  it('keeps the persisted conversation identifier across turns and model changes', () => {
    TestBed.configureTestingModule({providers: [
      {provide: Store, useValue: {select: () => of(null)}},
      {provide: ServiceProvider, useValue: {apiUrl: '/'}},
      {provide: AuthService, useValue: {token: 'test'}},
      {provide: LocalizationService, useValue: {requestLanguage: 'en'}}
    ]});
    const service = TestBed.inject(RelaxKonService);
    const history = new ChatHistoryModel();
    const restored = Object.assign(new ChatHistoryModel(), structuredClone(history));
    const send = spyOn(service, 'fetchChatBase').and.returnValue(of(''));
    service.fetchChat(new ChatPacket([{role: 'user', content: 'hello'}], history.dataId!.toString()), 'first-model');
    service.fetchChat(new ChatPacket([{role: 'user', content: 'next turn'}], restored.dataId!.toString()), 'second-model');
    expect(send.calls.allArgs().map(args => args[1].conversationId)).toEqual([
      history.dataId!.toString(), history.dataId!.toString()
    ]);
    expect(send.calls.mostRecent().args[1].model).toBe('second-model');
  });
  for (const [status, code] of [[403, 'feature_disabled'], [429, 'feature_limit_exceeded'], [503, 'feature_access_unavailable']] as const) {
    it(`preserves admission error ${code}`, async () => {
      TestBed.configureTestingModule({providers: [
        {provide: Store, useValue: {select: () => of(null)}},
        {provide: ServiceProvider, useValue: {apiUrl: '/'}},
        {provide: AuthService, useValue: {token: 'test'}},
        {provide: LocalizationService, useValue: {requestLanguage: 'zh'}}
      ]});
      spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify({code}), {status}));
      await expectAsync(firstValueFrom(TestBed.inject(RelaxKonService).fetchChatBase('/api/ai/chat',
        {model: 'test', messages: []}))).toBeRejectedWith(jasmine.objectContaining({status, code}));
    });
  }
  it('omits generation settings even when legacy stored configuration contains them', () => {
    TestBed.configureTestingModule({providers: [
      {provide: Store, useValue: {select: () => of(null)}},
      {provide: ServiceProvider, useValue: {apiUrl: '/'}},
      {provide: AuthService, useValue: {token: 'test'}},
      {provide: LocalizationService, useValue: {requestLanguage: 'ja'}}
    ]});
    const service = TestBed.inject(RelaxKonService);
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
    const chunks = await firstValueFrom(TestBed.inject(RelaxKonService).fetchChatBase('/api/ai/chat', {model: 'test', messages: [{role: 'user', content: 'hello'}]}).pipe(toArray()));
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
    const subscription = TestBed.inject(RelaxKonService).fetchChatBase('/api/ai/chat', {model: 'test', messages: [{role: 'user', content: 'hello'}]}).subscribe();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(auth.refreshAccessToken).toHaveBeenCalled();
    subscription.unsubscribe();
    refresh.next('new-token');
    refresh.complete();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

});

describe('Chat throttling without automatic generation replay', () => {
  let service: RelaxKonService;
  let auth: {token: string; user: {id: number}; refreshToken?: string; refreshAccessToken?: jasmine.Spy};
  const body = {model: 'test', messages: []};
  const completed = () => new Response('data: {"type":"delta","text":"done"}\n\ndata: {"type":"completed"}\n\n',
    {headers: {'Content-Type': 'text/event-stream'}});
  beforeEach(() => {
    auth = {token: 'test', user: {id: 7}};
    TestBed.configureTestingModule({providers: [
      {provide: Store, useValue: {select: () => of(null)}},
      {provide: ServiceProvider, useValue: {apiUrl: '/'}},
      {provide: AuthService, useValue: auth},
      {provide: LocalizationService, useValue: {requestLanguage: 'en'}}
    ]});
    service = TestBed.inject(RelaxKonService);
  });
  const send = (service: RelaxKonService) => firstValueFrom(service.fetchChatBase('/api/ai/chat', body));

  it('preserves Retry-After, blocks early manual repeats and allows an explicit attempt after expiry', async () => {
    const now = spyOn(Date, 'now').and.returnValue(100000);
    const fetch = spyOn(window, 'fetch').and.resolveTo(new Response('{"code":"feature_limit_exceeded"}',
      {status: 429, headers: {'Retry-After': '10'}}));
    await expectAsync(send(service)).toBeRejectedWith(jasmine.objectContaining({type: ErrorType.Busy, status: 429, retryAfterSeconds: 10}));
    expect(fetch).toHaveBeenCalledTimes(1);
    now.and.returnValue(104001);
    await expectAsync(send(service)).toBeRejectedWith(jasmine.objectContaining({code: 'feature_limit_exceeded', retryAfterSeconds: 6}));
    expect(fetch).toHaveBeenCalledTimes(1);
    now.and.returnValue(110000); fetch.and.resolveTo(completed());
    expect(await send(service)).toBe('done'); expect(fetch).toHaveBeenCalledTimes(2);
  });

  for (const retryAfter of [undefined, 'garbage', '-1']) {
    it(`preserves manual-retry fallback for Retry-After ${retryAfter}`, async () => {
      const fetch = spyOn(window, 'fetch').and.callFake(async () => new Response('{"code":"feature_limit_exceeded"}',
        {status: 429, headers: retryAfter ? {'Retry-After': retryAfter} : {}}));
      const error = await send(service).catch(error => error);
      expect(error.code).toBe('feature_limit_exceeded'); expect(error.retryAfterSeconds).toBeUndefined();
      expect(fetch).toHaveBeenCalledTimes(1);
      await send(service).catch(() => undefined); expect(fetch).toHaveBeenCalledTimes(2);
    });
  }

  it('honors an HTTP-date header and does not mistake a provider limit for a feature quota', async () => {
    spyOn(Date, 'now').and.returnValue(Date.parse('Fri, 06 Nov 2026 12:00:00 GMT'));
    spyOn(window, 'fetch').and.resolveTo(new Response('{}', {status: 429, headers: {'Retry-After': 'Fri, 06 Nov 2026 12:01:00 GMT'}}));
    await expectAsync(send(service)).toBeRejectedWith(jasmine.objectContaining({status: 429, code: undefined, retryAfterSeconds: 60}));
  });

  it('isolates cooldowns by account and retains the original account cooldown when switching back', async () => {
    const fetch = spyOn(window, 'fetch').and.resolveTo(new Response('{}', {status: 429, headers: {'Retry-After': '60'}}));
    await send(service).catch(() => undefined);
    auth.user = {id: 8}; fetch.and.resolveTo(completed());
    expect(await send(service)).toBe('done'); expect(fetch).toHaveBeenCalledTimes(2);
    auth.user = {id: 7};
    await expectAsync(send(service)).toBeRejectedWith(jasmine.objectContaining({status: 429}));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not apply an in-flight response to a new account or replay its generation', async () => {
    let resolve!: (response: Response) => void;
    const fetch = spyOn(window, 'fetch').and.returnValue(new Promise<Response>(done => resolve = done));
    const result = send(service).catch(error => error);
    auth.user = {id: 8};
    resolve(new Response('{}', {status: 429, headers: {'Retry-After': '60'}}));
    expect((await result).code).toBe('account_changed'); expect(fetch).toHaveBeenCalledTimes(1);
    fetch.and.resolveTo(completed()); expect(await send(service)).toBe('done');
  });

  it('does not refresh or replay after the account changes before a 401 response', async () => {
    let resolve!: (response: Response) => void;
    auth.refreshToken = 'refresh'; auth.refreshAccessToken = jasmine.createSpy().and.returnValue(of('new'));
    const fetch = spyOn(window, 'fetch').and.returnValue(new Promise<Response>(done => resolve = done));
    const result = send(service).catch(error => error); auth.user = {id: 8};
    resolve(new Response('', {status: 401}));
    expect((await result).code).toBe('account_changed');
    expect(fetch).toHaveBeenCalledTimes(1); expect(auth.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('aborts a cancelled request and never schedules a rate-limit retry', async () => {
    let resolve!: (response: Response) => void;
    const fetch = spyOn(window, 'fetch').and.returnValue(new Promise<Response>(done => resolve = done));
    const error = jasmine.createSpy();
    const subscription = service.fetchChatBase('/api/ai/chat', body).subscribe({error});
    subscription.unsubscribe(); resolve(new Response('{}', {status: 429, headers: {'Retry-After': '1'}}));
    await new Promise(done => setTimeout(done, 0));
    expect(fetch.calls.mostRecent().args[1]?.signal?.aborted).toBeTrue();
    expect(fetch).toHaveBeenCalledTimes(1); expect(error).not.toHaveBeenCalled();
  });
});
