import {TestBed} from '@angular/core/testing';
import {HttpErrorResponse, provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {firstValueFrom} from 'rxjs';
import {ServiceProvider} from '../roots';
import {AuthCallService} from '../auth_module/auth-call.service';
import {AccountCallService} from '../admin/services/account-call.service';
import {KeyCallService} from '../admin/services/key-call.service';
import {ReloadService} from '../admin/auth_module/reload.service';
import {OpenaiService} from './fetch_services/openai.service';
import {ApimartService} from './fetch_services/apimart.service';
import {ParseService} from './fetch_services/parse.service';
import {NumerService} from './fetch_services/numer.service';
import {SendService} from '../auth_module/send.service';
import {apiErrorMessage} from '../contracts/common';
import type {AccountResponse, KeyResponse, TokenResponse, ImageGenerationResponse, AudioTextResponse, APIMartTaskResponse} from '../contracts';
import {imageSource} from './media-results';

// Wire fixtures follow backend Contracts, including required nullable properties and snake_case.
const image: ImageGenerationResponse = {created: 123, data: [{url: null, b64_json: 'AQID', revised_prompt: 'revised'}],
  background: 'transparent', output_format: 'webp', quality: 'high', size: '1024x1024',
  usage: {input_tokens: 1, output_tokens: 2, total_tokens: 3}};
const audio: AudioTextResponse = {text: '你好', language: null, duration: null, segments: null, words: null};
const token: TokenResponse = {token: 'access', accessToken: 'access', refreshToken: 'refresh', id: 2,
  sessionId: 'session', accessTokenExpiresIn: 900, refreshTokenExpiresAt: '2026-12-01T00:00:00Z'};

describe('Backend HTTP contracts', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(),
      {provide: ServiceProvider, useValue: {apiUrl: '/backend/'}}]});
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('uses the exact registration fields including confirm and receives an empty success', async () => {
    const value = {username: 'user', password: 'secret123', confirm: 'secret123', email: 'test@example.invalid', agree: true, captcha: 'local'};
    const result = firstValueFrom(TestBed.inject(AuthCallService).register(value));
    const request = http.expectOne('/backend/api/auth/register');
    expect(request.request.body).toEqual({username: value.username, password: value.password, confirm: value.confirm, email: value.email});
    request.flush(null); await result;
  });

  it('preserves token expiry fields and base64 SVG captcha metadata', async () => {
    const auth = TestBed.inject(AuthCallService);
    const login = firstValueFrom(auth.login({username: 'user', password: 'secret'}));
    http.expectOne('/backend/api/auth/login').flush(token);
    expect((await login).accessTokenExpiresIn).toBe(900);
    const captcha = firstValueFrom(auth.generateVerificationCode());
    http.expectOne('/backend/api/verification/generate').flush({img: 'PHN2Zy8+', code: 'ABC123', contentType: 'image/svg+xml'});
    expect((await captcha).contentType).toBe('image/svg+xml');
  });

  it('normalizes nullable account responses without inventing a password', async () => {
    const result = firstValueFrom(TestBed.inject(AccountCallService).getAccountById(2));
    const response: AccountResponse = {accountId: 2, username: null, email: null, userRoles: [{roleId: 1, name: null}]};
    http.expectOne('/backend/api/account/2').flush(response);
    expect(await result).toEqual({accountId: 2, username: '', email: '', userRoles: [{roleId: 1, name: ''}]});
    expect('password' in await result).toBeFalse();
  });

  it('strips account navigation data and omits an unchanged password when updating', async () => {
    const account = {accountId: 2, username: 'user', email: 'test@example.invalid', password: '', securityStamp: 'private',
      userRoles: [{roleId: 1, name: 'user', accounts: [{password: 'private'}]}]};
    const result = firstValueFrom(TestBed.inject(AccountCallService).updateAccount(account));
    const request = http.expectOne('/backend/api/account/2');
    expect(JSON.parse(JSON.stringify(request.request.body))).toEqual({accountId: 2, username: 'user', email: 'test@example.invalid', userRoles: [{roleId: 1}]});
    request.flush(null); await result;
  });

  it('preserves aliases and priorities while excluding key relationship graphs and IDs', async () => {
    const key = {supplierKeyId: 7, baseUrl: 'https://provider.invalid/v1', apiKey: 'test-key', requestIdentifier: 0, enable: true,
      modelKeyBinds: [{modelKeyBindId: 999, modelId: 3, supplierKeyId: 100, fee: 0, enable: true, providerModelValue: 'upstream-model', priority: -1,
        model: {modelId: 3, name: 'logical', modelValue: 'logical', isChatModel: true, vision: true}}]};
    const result = firstValueFrom(TestBed.inject(KeyCallService).updateKey(key));
    const request = http.expectOne('/backend/api/key/7');
    expect(request.request.body).toEqual({...key, modelKeyBinds: [{modelId: 3, fee: 0, enable: true, providerModelValue: 'upstream-model', priority: -1}]});
    expect(key.modelKeyBinds[0].modelKeyBindId).toBe(999);
    request.flush(null); await result;
  });

  it('normalizes nullable keys and keeps routing metadata for the next edit', async () => {
    const result = firstValueFrom(TestBed.inject(KeyCallService).getKeyById(7));
    const response: KeyResponse = {supplierKeyId: 7, baseUrl: null, apiKey: null, requestIdentifier: 0, enable: true,
      modelKeyBinds: [{modelKeyBindId: 9, supplierKeyId: 7, modelId: 3, fee: 1, enable: true, providerModelValue: 'alias', priority: 4, model: null}]};
    http.expectOne('/backend/api/key/7').flush(response);
    const key = await result;
    expect(key.baseUrl).toBe(''); expect(key.modelKeyBinds![0].providerModelValue).toBe('alias');
    expect(key.modelKeyBinds![0].priority).toBe(4); expect(key.modelKeyBinds![0].model).toBeUndefined();
  });

  it('uses zero IDs for creates and consistent positive IDs for updates', async () => {
    const api = TestBed.inject(KeyCallService);
    const create = firstValueFrom(api.addModel({modelId: 123, name: 'logical', modelValue: 'logical', enable: true, vision: true, isChatModel: true}));
    const request = http.expectOne('/backend/api/model');
    expect(request.request.body).toEqual({modelId: 0, name: 'logical', modelValue: 'logical', vision: true, isChatModel: true});
    request.flush(null); await create;
    expect(() => api.updateModel({name: 'no-id', modelValue: 'no-id', vision: true, isChatModel: true})).toThrowError(/positive entity ID/);
    const status = firstValueFrom(api.disableModel(3));
    const update = http.expectOne('/backend/api/model/changeModelStatus/3');
    expect(update.request.body).toEqual({modelId: 3, enable: false}); update.flush({msg: 'done'});
    expect((await status).msg).toBe('done');
  });

  it('maps chat models without relying on absent SDK or entity fields', async () => {
    const result = firstValueFrom(TestBed.inject(NumerService).getChatModels());
    http.expectOne('/backend/api/ai/models').flush([{modelName: null, modelValue: 'logical', vision: false}, {modelName: 'invalid', modelValue: null, vision: false}]);
    expect(await result).toEqual([{modelName: 'logical', modelValue: 'logical', vision: false}]);
  });

  it('reads typed speech and nullable transcription responses', async () => {
    const api = TestBed.inject(OpenaiService);
    const speech = api.tts({input: 'hello', response_format: 'wav'});
    const request = http.expectOne('/backend/api/media/tts');
    expect(request.request.body.response_format).toBe('wav'); request.flush({base64: 'AQID', type: 'wav'});
    expect((await speech).type).toBe('wav');
    const transcript = api.transcription({file: 'AQID', model: 'logical', response_format: 'json', suffix: 'wav'});
    http.expectOne('/backend/api/media/whisper-transcription').flush(audio);
    expect(await transcript).toEqual(audio);
  });

  it('renders b64_json with the returned MIME type and keeps structured image usage', async () => {
    const result = TestBed.inject(OpenaiService).gptImageCreate({prompt: 'test', output_format: 'webp', background: 'transparent'});
    http.expectOne('/backend/api/media/gpt-image').flush(image);
    const response = await result;
    expect(imageSource(response.data[0], response.output_format)).toBe('data:image/webp;base64,AQID');
    expect(response.usage?.total_tokens).toBe(3);
    expect(imageSource({url: 'https://image.invalid/a', b64_json: null, revised_prompt: null})).toBe('https://image.invalid/a');
    expect(imageSource({url: null, b64_json: null, revised_prompt: null})).toBe('');
  });

  it('preserves an HTTP ProblemDetails failure rather than resolving an SDK success object', async () => {
    const result = TestBed.inject(OpenaiService).translate({file: 'AQID', model: 'logical'}).catch((error: unknown) => error);
    http.expectOne('/backend/api/media/whisper-translate').flush({status: 400, title: 'Invalid file', errors: {File: ['Invalid base64']}}, {status: 400, statusText: 'Bad Request'});
    const failure = await result;
    expect(failure instanceof HttpErrorResponse).toBeTrue();
    expect(apiErrorMessage(failure, 'fallback')).toBe('Invalid base64');
  });

  it('encodes task IDs and reads APIMart snake_case timestamps and nullable data', async () => {
    const api = TestBed.inject(ApimartService);
    const result = api.getApiMartTask('task/a?b');
    const request = http.expectOne('/backend/api/apimart/getTask/task%2Fa%3Fb?language=zh');
    const task: APIMartTaskResponse = {code: 200, data: {id: 'task/a?b', status: 'completed', progress: 100, created: 1, completed: 2,
      estimated_time: 5, actual_time: 1, result: {images: [{url: ['https://image.invalid/a'], expires_at: 500}]}}};
    request.flush(task); expect((await result).data?.result?.images[0].expires_at).toBe(500);
    const empty = api.getApiMartTask('empty');
    http.expectOne('/backend/api/apimart/getTask/empty?language=zh').flush({code: 200, data: null});
    expect((await empty).data).toBeNull();
  });

  it('does not swallow APIMart task HTTP errors', async () => {
    const result = TestBed.inject(ApimartService).getApiMartTask('other').catch((error: unknown) => error);
    http.expectOne('/backend/api/apimart/getTask/other?language=zh').flush({code: 'not_found'}, {status: 404, statusText: 'Not Found'});
    expect(await result instanceof HttpErrorResponse).toBeTrue();
  });

  it('extracts file content without transmitting local parsed data or database fields', async () => {
    const file = {fileName: 'a.txt', fileType: 'text/plain', fileSize: 3, fileContent: 'AQID', parsedContent: 'local-only', fileAddsId: 999};
    const result = firstValueFrom(TestBed.inject(ParseService).parse(file));
    const request = http.expectOne('/backend/api/fileExtractor');
    expect(request.request.body).toEqual({fileName: 'a.txt', fileType: 'text/plain', fileSize: 3, fileContent: 'AQID'});
    request.flush({content: 'extracted'}); expect((await result).content).toBe('extracted');
  });

  it('uses empty successes and removes identity from legacy task writes', async () => {
    const result = firstValueFrom(TestBed.inject(SendService).sendTask({task_id: 'task', account_id: 99, date: new Date('2026-11-04T00:00:00Z'), images: null}));
    const request = http.expectOne('/backend/api/receiver/task');
    expect(JSON.parse(JSON.stringify(request.request.body))).toEqual({task_id: 'task', date: '2026-11-04T00:00:00.000Z', images: null});
    request.flush(null); await result;
    const refresh = firstValueFrom(TestBed.inject(ReloadService).loadKeys());
    http.expectOne('/backend/api/sync/loadKeys').flush({msg: 'loaded'}); expect((await refresh).msg).toBe('loaded');
  });
});

describe('API error messages', () => {
  it('handles message, ProblemDetails and legacy string errors without rendering objects', () => {
    expect(apiErrorMessage({error: {code: 'conflict', message: 'reload'}}, 'fallback')).toBe('reload');
    expect(apiErrorMessage({error: {title: 'unavailable'}}, 'fallback')).toBe('unavailable');
    expect(apiErrorMessage({error: 'legacy'}, 'fallback')).toBe('legacy');
    for (const error of [null, undefined, {error: {}}, {error: {message: {secret: 'private'}}}])
      expect(apiErrorMessage(error, 'fallback')).toBe('fallback');
  });
});
