import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ServiceProvider} from '../roots';
import {LibraryService} from './library.service';
import {LibraryItem} from '../contracts/library';

describe('Private library API', () => {
  it('uses authenticated requests, multipart upload and versioned mutations without public URLs', () => {
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(), {provide: ServiceProvider, useValue: {apiUrl: '/backend/'}}]});
    const api = TestBed.inject(LibraryService); const http = TestBed.inject(HttpTestingController);
    const item: LibraryItem = {id: 'id/one', name: 'hello.txt', contentType: 'text/plain', size: 2, version: 4, createdAt: '', updatedAt: ''};
    api.list().subscribe(); http.expectOne('/backend/api/library').flush({items: []});
    api.upload(new File(['hi'], 'hello.txt')).subscribe(); const upload = http.expectOne('/backend/api/library');
    expect(upload.request.method).toBe('POST'); expect(upload.request.body instanceof FormData).toBeTrue();
    expect(upload.request.body.get('file').name).toBe('hello.txt'); upload.flush(item);
    api.content(item.id).subscribe(); const content = http.expectOne('/backend/api/library/id%2Fone/content');
    expect(content.request.responseType).toBe('blob'); content.flush(new Blob(['hi']));
    api.rename(item, 'other.txt').subscribe(); const rename = http.expectOne('/backend/api/library/id%2Fone');
    expect(rename.request.method).toBe('PATCH'); expect(rename.request.body).toEqual({name: 'other.txt', version: 4}); rename.flush(item);
    api.remove(item).subscribe(); const remove = http.expectOne('/backend/api/library/id%2Fone?version=4');
    expect(remove.request.method).toBe('DELETE'); remove.flush(null); http.verify();
  });
});
