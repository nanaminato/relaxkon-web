import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {firstValueFrom} from 'rxjs';
import {ApimartService} from './apimart.service';
import {ServiceProvider} from '../../roots';
describe('APIMart image HTTP protocol', () => {
  let api: ApimartService, http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(), {provide: ServiceProvider, useValue: {apiUrl: '/backend/'}}]});
    api = TestBed.inject(ApimartService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('posts supported creation DTOs with the original idempotency key and no browser API key', async () => {
    const body = {model: 'gpt-image-2.5-ext' as const, prompt: 'image', version: 'sunburst' as const, n: 1, resolution: '2K', idempotency_key: 'original-operation'};
    const result = api.generateImage(body);
    const request = http.expectOne('/backend/api/apimart/image-generate/gpt-image');
    expect(request.request.body).toEqual(body); expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({code: 202, data: {id: 'task-one', status: 'pending'}});
    expect((await result).code).toBe(202);
  });
  it('uploads multipart files and recovers receipts without calling generation', async () => {
    const file = new File(['png'], 'reference.png', {type: 'image/png'});
    const upload = api.uploadImage(file);
    const request = http.expectOne('/backend/api/apimart/uploads/images');
    expect(request.request.body instanceof FormData).toBeTrue(); expect(request.request.body.get('file').name).toBe('reference.png');
    expect(request.request.headers.has('Content-Type')).toBeFalse(); request.flush({url: 'https://images.example.invalid/a.png'});
    expect((await upload).url).toContain('https://');
    const recover = api.recoverReceipt('opaque-recovery');
    http.expectOne('/backend/api/apimart/image-generate/receipt').flush({code: 200, data: [{task_id: 'one'}]});
    expect((await recover).code).toBe(200);
  });
  it('encodes task IDs and sends normalized language only to the owned backend', async () => {
    const result = firstValueFrom(api.watchTask('task/a?x=y', 'ja'));
    const request = http.expectOne('/backend/api/apimart/getTask/task%2Fa%3Fx%3Dy?language=ja');
    expect(request.request.method).toBe('GET'); request.flush({code: 200, data: null});
    expect((await result).data).toBeNull();
  });
});
