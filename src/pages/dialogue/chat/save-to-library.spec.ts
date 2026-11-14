import {attachmentFile} from './save-to-library';

describe('Save attachment to library', () => {
  it('converts raw base64 and data URLs without including extracted text', async () => {
    const file = attachmentFile({fileName: 'notes.txt', fileType: 'text/plain', fileContent: 'data:text/plain;base64,aGVsbG8=', parsedContent: 'secret extracted text'});
    expect(file.name).toBe('notes.txt');
    expect(await file.text()).toBe('hello');
    expect(await attachmentFile({fileName: 'notes.txt', fileContent: 'aGVsbG8='}).text()).toBe('hello');
  });
  it('rejects missing, invalid and oversized payloads before upload', () => {
    expect(() => attachmentFile({fileName: 'a'})).toThrow();
    expect(() => attachmentFile({fileName: 'a', fileContent: '%%%'})).toThrow();
    expect(() => attachmentFile({fileName: 'a', fileContent: 'A'.repeat(28 * 1024 * 1024 + 1)})).toThrow();
  });
});

import {TestBed} from '@angular/core/testing';
import {BehaviorSubject, Subject} from 'rxjs';
import {AuthService} from '../../../auth_module';
import {LibraryService} from '../../../services/library.service';
import {SaveToLibrary} from './save-to-library';

describe('Explicit attachment saving', () => {
  it('does not upload until clicked and prevents duplicate concurrent saves', () => {
    const uploadResult = new Subject();
    const upload = jasmine.createSpy().and.returnValue(uploadResult);
    const auth = {user: {id: 1}, isLogin: true, accountId$: new BehaviorSubject<number | undefined>(1)};
    TestBed.configureTestingModule({providers: [{provide: AuthService, useValue: auth}, {provide: LibraryService, useValue: {upload}}]});
    const component = TestBed.runInInjectionContext(() => new SaveToLibrary());
    component.file = {fileName: 'a', fileContent: 'aGVsbG8='};
    expect(upload).not.toHaveBeenCalled();
    component.save(); component.save();
    expect(upload).toHaveBeenCalledTimes(1);
    uploadResult.next({}); component.save();
    expect(component.saved).toBeTrue(); expect(upload).toHaveBeenCalledTimes(1);
    component.ngOnDestroy();
  });
  it('invalidates old attachment controls when switching account', () => {
    const uploadResult = new Subject();
    const upload = jasmine.createSpy().and.returnValue(uploadResult);
    const auth = {user: {id: 1}, isLogin: true, accountId$: new BehaviorSubject<number | undefined>(1)};
    TestBed.configureTestingModule({providers: [{provide: AuthService, useValue: auth}, {provide: LibraryService, useValue: {upload}}]});
    const component = TestBed.runInInjectionContext(() => new SaveToLibrary());
    component.file = {fileName: 'a', fileContent: 'aGVsbG8='};
    component.save(); auth.user = {id: 2}; auth.accountId$.next(2); uploadResult.next({}); component.save();
    expect(component.saved).toBeFalse(); expect(upload).toHaveBeenCalledTimes(1);
    component.ngOnDestroy();
  });
});
