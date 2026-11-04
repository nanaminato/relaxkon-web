import {TestBed} from '@angular/core/testing';
import {NzNotificationService} from 'ng-zorro-antd/notification';
import {GptImageCreate} from './gpt-image-create.component';
import {OpenaiService} from '../../../services/fetch_services/openai.service';
import {UniversalService} from '../../../services/db-services/universal.service';
import {AuthService, SendManagerService} from '../../../auth_module';
import {MenuAbleService} from '../../../services/normal-services/menu-able.service';
import {LocalizationService} from '../../../services/normal-services/localization.service';
import {SizeReportService} from '../../../services/normal-services/sizeReport.service';
import type {ImageGenerationResponse} from '../../../contracts/media';

describe('Generated image contract', () => {
  let response: ImageGenerationResponse;
  let save: jasmine.Spy;
  let send: jasmine.Spy;
  let error: jasmine.Spy;
  let generate: jasmine.Spy;
  beforeEach(() => {
    response = {created: 1, data: [{url: null, b64_json: 'AQID', revised_prompt: null}], background: 'transparent',
      output_format: 'jpeg', quality: 'high', size: '1024x1024', usage: null};
    save = jasmine.createSpy('save').and.resolveTo(); send = jasmine.createSpy('send').and.resolveTo('queued'); error = jasmine.createSpy('error');
    generate = jasmine.createSpy('generate').and.callFake(() => Promise.resolve(response));
    TestBed.configureTestingModule({providers: [GptImageCreate,
      {provide: MenuAbleService, useValue: {enableImage: () => undefined}},
      {provide: NzNotificationService, useValue: {error}},
      {provide: UniversalService, useValue: {addOrUpdateGenerateTask: save}},
      {provide: OpenaiService, useValue: {gptImageCreate: generate}},
      {provide: AuthService, useValue: {user: {id: 3}}},
      {provide: SendManagerService, useValue: {sendTask: send}},
      {provide: SizeReportService, useValue: {}},
      {provide: LocalizationService, useValue: {text: (key: string) => key}}
    ]});
  });
  it('displays and persists b64_json using output_format and sends the selected background', async () => {
    const page = TestBed.inject(GptImageCreate); page.model = 'gpt-image-test'; page.prompt = 'image'; page.background = 'transparent';
    await page.generateImages();
    expect(generate.calls.mostRecent().args[0].background).toBe('transparent');
    expect(page.images?.[0].image_url).toBe('data:image/jpeg;base64,AQID');
    expect(save.calls.mostRecent().args[0].images).toEqual(['data:image/jpeg;base64,AQID']);
    expect(send).toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
  });
  it('rejects nullable image results with neither a URL nor base64 instead of saving empty images', async () => {
    response.data = [{url: null, b64_json: null, revised_prompt: null}];
    const page = TestBed.inject(GptImageCreate); page.model = 'gpt-image-test';
    await page.generateImages();
    expect(save).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled(); expect(error).toHaveBeenCalled();
    expect(page.loading).toBeFalse();
  });
});
