import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {AuthenticatedImage} from './authenticated-image';
import {ServiceProvider} from '../roots';

describe('Authenticated image', () => {
  it('loads proxy images as blobs and revokes URLs when replaced or destroyed', () => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(), {provide: ServiceProvider, useValue: {apiUrl: '/'}}]});
    spyOn(URL, 'createObjectURL').and.returnValue('blob:image');
    spyOn(URL, 'revokeObjectURL');
    const component = TestBed.runInInjectionContext(() => new AuthenticatedImage());
    const http = TestBed.inject(HttpTestingController);
    component.url = 'https://cdn.example/image.png'; component.proxy = true; component.ngOnChanges();
    const req = http.expectOne(request => request.url === '/api/image_proxy/get');
    expect(req.request.params.get('url')).toBe(component.url);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['image'], {type: 'image/png'}));
    expect(component.src).toBe('blob:image');
    component.ngOnDestroy();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:image');
    http.verify();
  });
});
