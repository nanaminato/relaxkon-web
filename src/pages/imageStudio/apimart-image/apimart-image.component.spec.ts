import {fakeAsync, flushMicrotasks, TestBed, tick} from '@angular/core/testing';
import {of, Subject, throwError} from 'rxjs';
import {APIMartImage} from './apimart-image.component';
import {ApimartService} from '../../../services/fetch_services/apimart.service';
import {AuthService, SendManagerService} from '../../../auth_module';
import {UniversalService} from '../../../services/db-services/universal.service';
import {LocalizationService, SizeReportService} from '../../../services/normal-services';
import {MenuAbleService} from '../../../services/normal-services/menu-able.service';

describe('APIMart accepted task lifecycle', () => {
  let page: APIMartImage, api: any, auth: any, save: jasmine.Spy, send: jasmine.Spy;
  const status = (state = 'processing') => ({code: 200, data: {id: 'task-one', status: state, progress: 40,
    result: state === 'completed' ? {images: [{url: ['https://images.example.invalid/a.png', 'https://images.example.invalid/b.png']}]} : null}});
  beforeEach(() => {
    sessionStorage.removeItem('turbo-apimart-receipt:7');
    api = {generateImage: jasmine.createSpy().and.resolveTo({code: 200, data: [{task_id: 'task-one'}]}),
      watchTask: jasmine.createSpy().and.returnValue(of(status())),
      recoverReceipt: jasmine.createSpy().and.resolveTo({code: 200, data: [{task_id: 'task-one'}]}),
      uploadImage: jasmine.createSpy().and.resolveTo({url: 'https://uploads.example.invalid/one.png'})};
    auth = {user: {id: 7}};
    save = jasmine.createSpy().and.resolveTo(); send = jasmine.createSpy().and.resolveTo();
    TestBed.configureTestingModule({providers: [APIMartImage, {provide: ApimartService, useValue: api},
      {provide: AuthService, useValue: auth}, {provide: UniversalService, useValue: {addOrUpdateGenerateTask: save}},
      {provide: SendManagerService, useValue: {sendTask: send}},
      {provide: LocalizationService, useValue: {text: (key: string) => key, requestLanguage: 'ja'}},
      {provide: SizeReportService, useValue: {}}, {provide: MenuAbleService, useValue: {enableImage: () => undefined}}]});
    page = TestBed.inject(APIMartImage); page.ngOnInit(); page.prompt = 'A garden';
  });
  afterEach(() => { page.ngOnDestroy(); sessionStorage.removeItem('turbo-apimart-receipt:7'); });

  it('submits once and preserves the accepted ID through poll failure, then resumes reads only', fakeAsync(() => {
    api.watchTask.and.returnValue(throwError(() => new Error('offline')));
    void page.submit(); void page.submit(); flushMicrotasks();
    expect(api.generateImage).toHaveBeenCalledTimes(1);
    expect(page.receipt?.taskId).toBe('task-one'); expect(page.state).toBe('paused');
    expect(page.canSubmit).toBeFalse(); void page.submit(); expect(api.generateImage).toHaveBeenCalledTimes(1);
    api.watchTask.and.returnValue(of(status('completed')));
    page.resumePolling(); flushMicrotasks();
    expect(page.state).toBe('completed'); expect(page.images.length).toBe(2);
    expect(save.calls.mostRecent().args[0].task_id).toBe('task-one'); expect(send).toHaveBeenCalledTimes(1);
    expect(api.watchTask.calls.mostRecent().args).toEqual(['task-one', 'ja']);
  }));
  it('bounds polling at five minutes and stops timers on pause/destroy without cancelling the provider', fakeAsync(() => {
    void page.submit(); flushMicrotasks(); tick(300000);
    expect(page.state).toBe('paused'); expect(api.watchTask).toHaveBeenCalledTimes(75);
    expect(api.generateImage).toHaveBeenCalledTimes(1); expect(page.receipt?.taskId).toBe('task-one');
    page.resumePolling(); page.ngOnDestroy(); const calls = api.watchTask.calls.count(); tick(20000);
    expect(api.watchTask.calls.count()).toBe(calls);
    expect(sessionStorage.getItem('turbo-apimart-receipt:7')).toContain('task-one');
  }));
  it('treats cancellation as terminal and never saves empty images', fakeAsync(() => {
    api.watchTask.and.returnValue(of(status('cancelled')));
    void page.submit(); flushMicrotasks();
    expect(page.state).toBe('cancelled'); expect(page.canStartNew).toBeTrue();
    expect(save).not.toHaveBeenCalled(); expect(api.generateImage).toHaveBeenCalledTimes(1);
  }));
  it('retains a receipt after ambiguous submission and requires explicit acknowledgement before a new operation', fakeAsync(() => {
    api.generateImage.and.rejectWith({status: 502, error: {code: 'image_submission_unknown'}});
    void page.submit(); flushMicrotasks(); expect(page.state).toBe('unknown');
    void page.submit(); expect(api.generateImage).toHaveBeenCalledTimes(1);
    page.startNew(); expect(page.state).toBe('unknown');
    page.resumeId = 'task-one'; page.resumeById(); expect(page.state).toBe('polling');
    expect(api.generateImage).toHaveBeenCalledTimes(1); page.pause();
  }));
  it('recovers an accepted receipt with the dedicated endpoint instead of resubmitting generation', fakeAsync(() => {
    api.generateImage.and.rejectWith({status: 502, error: {code: 'image_task_receipt_pending', task_ids: ['task-one'], recovery_token: 'opaque-recovery'}});
    void page.submit(); flushMicrotasks(); expect(page.state).toBe('receiptPending');
    expect(page.receipt?.taskId).toBe('task-one'); expect(api.watchTask).not.toHaveBeenCalled();
    void page.recoverReceipt(); flushMicrotasks();
    expect(api.recoverReceipt).toHaveBeenCalledOnceWith('opaque-recovery'); expect(api.generateImage).toHaveBeenCalledTimes(1);
    expect(page.receipt?.recoveryToken).toBeUndefined(); expect(page.state).toBe('polling'); page.pause();
  }));
  it('retains generated images on history failures and retries saves without another paid task', fakeAsync(() => {
    api.watchTask.and.returnValue(of(status('completed'))); save.and.rejectWith(new Error('quota'));
    void page.submit(); flushMicrotasks();
    expect(page.images.length).toBe(2); expect(page.historyWarning).toBeTruthy();
    save.and.resolveTo(); void page.retrySave(); flushMicrotasks();
    expect(api.generateImage).toHaveBeenCalledTimes(1); expect(send).toHaveBeenCalledTimes(1); expect(page.historyWarning).toBe('');
  }));
  it('never saves a result under an account that changed during polling', fakeAsync(() => {
    const query = new Subject(); api.watchTask.and.returnValue(query);
    void page.submit(); flushMicrotasks(); auth.user = {id: 8}; query.next(status('completed')); flushMicrotasks();
    expect(page.state).toBe('paused'); expect(save).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
  }));
  it('restores an account-scoped accepted task without automatically submitting again', fakeAsync(() => {
    void page.submit(); flushMicrotasks(); page.ngOnDestroy();
    const restored = TestBed.runInInjectionContext(() => new APIMartImage()); restored.ngOnInit();
    expect(restored.receipt?.taskId).toBe('task-one'); expect(restored.state).toBe('paused');
    expect(api.generateImage).toHaveBeenCalledTimes(1); restored.ngOnDestroy();
  }));
  it('uploads reference files once and preserves successful URLs if a later file fails', async () => {
    api.uploadImage.and.returnValues(Promise.resolve({url: 'https://uploads.example.invalid/one.png'}), Promise.reject(new Error('offline')));
    const files = [new File(['png'], 'one.png', {type: 'image/png'}), new File(['png'], 'two.png', {type: 'image/png'})];
    await page.upload({target: {files, value: 'files'}} as unknown as Event, 'references');
    expect(page.refs).toEqual(['https://uploads.example.invalid/one.png']);
    expect(page.uploading).toBeFalse(); expect(page.error).toBeTruthy(); expect(api.generateImage).not.toHaveBeenCalled();
  });

  it('preserves multiple accepted task IDs and queries each without another generation', fakeAsync(() => {
    api.generateImage.and.resolveTo({code: 200, data: [{task_id: 'task-one'}, {task_id: 'task-two'}]});
    void page.submit(); flushMicrotasks(); page.pause();
    expect(page.acceptedIds).toEqual(['task-one', 'task-two']);
    expect(sessionStorage.getItem('turbo-apimart-receipt:7')).toContain('task-two');
    const second = status('completed'); second.data.id = 'task-two'; api.watchTask.and.returnValue(of(second));
    page.selectTask('task-two'); flushMicrotasks();
    expect(page.state).toBe('completed'); expect(page.canStartNew).toBeFalse();
    expect(save.calls.mostRecent().args[0].task_id).toBe('task-two');
    expect(api.generateImage).toHaveBeenCalledTimes(1);
  }));
});
