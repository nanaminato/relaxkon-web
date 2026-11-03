import {TestBed} from '@angular/core/testing';
import {Store} from '@ngrx/store';
import {of, toArray, firstValueFrom} from 'rxjs';
import {AuthService} from '../../auth_module';
import {ServiceProvider} from '../../roots';
import {LocalizationService} from '../normal-services/localization.service';
import {TurboService} from './turbo.service';

describe('Multilingual chat streaming', () => {
  it('preserves UTF-8 characters split between chunks and sends the language', async () => {
    TestBed.configureTestingModule({providers: [
      {provide: Store, useValue: {select: () => of(null)}},
      {provide: ServiceProvider, useValue: {apiUrl: '/'}},
      {provide: AuthService, useValue: {token: 'test'}},
      {provide: LocalizationService, useValue: {requestLanguage: 'ja'}}
    ]});
    const text = '你好、日本語🙂';
    const bytes = new TextEncoder().encode(text);
    const stream = new ReadableStream<Uint8Array>({start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    }});
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response(stream));
    const chunks = await firstValueFrom(TestBed.inject(TurboService).fetchChatBase('/api/ai/chat', {}).pipe(toArray()));
    expect(chunks.join('')).toBe(text);
    expect((fetchSpy.calls.mostRecent().args[1]?.headers as Record<string, string>)['Accept-Language']).toBe('ja');
  });
});
