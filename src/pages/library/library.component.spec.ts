import {TestBed} from '@angular/core/testing';
import {BehaviorSubject, of, Subject, throwError} from 'rxjs';
import {AuthService} from '../../auth_module';
import {LibraryService} from '../../services/library.service';
import {LibraryComponent, libraryError} from './library.component';
import {LibraryItem, LibrarySnapshot} from '../../contracts/library';

const item: LibraryItem = {id: 'one', name: 'notes.txt', contentType: 'text/plain', size: 5, version: 2, createdAt: '', updatedAt: ''};
const snapshot = (): LibrarySnapshot => ({items: [{...item}], usedBytes: 5, maxBytes: 100, maxFileBytes: 50, maxFiles: 10});
describe('Library page', () => {
  let component: LibraryComponent;
  let account: BehaviorSubject<number | undefined>;
  let api: {list: jasmine.Spy; upload: jasmine.Spy; rename: jasmine.Spy; remove: jasmine.Spy; content: jasmine.Spy};
  beforeEach(() => {
    account = new BehaviorSubject<number | undefined>(1);
    api = {list: jasmine.createSpy().and.callFake(() => of(snapshot())), upload: jasmine.createSpy().and.returnValue(of(item)),
      rename: jasmine.createSpy().and.returnValue(of(item)), remove: jasmine.createSpy().and.returnValue(of(undefined)), content: jasmine.createSpy()};
    TestBed.configureTestingModule({providers: [{provide: LibraryService, useValue: api}, {provide: AuthService, useValue: {accountId$: account}}]});
    component = TestBed.runInInjectionContext(() => new LibraryComponent()); component.ngOnInit();
  });
  it('loads the owner list and filters by name and media type', () => {
    expect(component.items.length).toBe(1);
    component.query = 'NOTES'; expect(component.items.length).toBe(1);
    component.filter = 'image'; expect(component.items.length).toBe(0);
    component.filter = 'document'; expect(component.items.length).toBe(1);
  });
  it('clears private data and ignores pending results after sign-out', () => {
    const pending = new Subject<LibrarySnapshot>(); api.list.and.returnValue(pending);
    component.reload(); account.next(undefined); pending.next(snapshot());
    expect(component.snapshot).toBeUndefined(); expect(component.disabled).toBeTrue();
  });
  it('ignores old account completion after switching accounts', () => {
    const pending = new Subject<LibrarySnapshot>(); api.list.and.returnValue(pending);
    component.reload(); api.list.and.returnValue(of({...snapshot(), items: []})); account.next(2);
    pending.next(snapshot()); expect(component.items).toEqual([]);
  });
  it('requires explicit confirmation and sends the captured version for deletion', () => {
    component.remove(); expect(api.remove).not.toHaveBeenCalled();
    component.requestDelete(item); component.cancel(); component.remove(); expect(api.remove).not.toHaveBeenCalled();
    component.requestDelete(item); component.remove(); expect(api.remove).toHaveBeenCalledOnceWith(item);
  });
  it('prevents duplicate mutations and resolves conflicts by refreshing', () => {
    const pending = new Subject<LibraryItem>(); api.rename.and.returnValue(pending);
    component.requestRename(item); component.editName = 'new.txt'; component.rename(); component.rename();
    expect(api.rename).toHaveBeenCalledTimes(1); pending.error({status: 409});
    expect(component.status).toBe('library.conflict'); expect(component.editing).toBeUndefined(); expect(component.busy).toBeFalse();
  });
  it('does not discard rename drafts on network failure or auto-refresh', () => {
    api.rename.and.returnValue(throwError(() => ({status: 0})));
    component.requestRename(item); component.editName = 'new.txt'; component.onFocus();
    expect(api.list).toHaveBeenCalledTimes(1); component.rename();
    expect(component.editName).toBe('new.txt'); expect(component.editing?.id).toBe(item.id);
  });
  it('rejects oversized uploads locally', () => {
    const input = {files: [new File(['a'.repeat(51)], 'large.txt')], value: 'selected'};
    component.beginPick(); component.choose({target: input} as unknown as Event);
    expect(api.upload).not.toHaveBeenCalled(); expect(input.value).toBe(''); expect(component.status).toBe('library.tooLarge');
  });
  it('releases pending mutation state when identity changes without replaying', () => {
    const pending = new Subject<LibraryItem>(); api.upload.and.returnValue(pending);
    component.beginPick(); component.choose({target: {files: [new File(['a'], 'a.txt')], value: ''}} as unknown as Event);
    account.next(undefined); pending.next(item);
    expect(component.snapshot).toBeUndefined(); expect(component.busy).toBeFalse(); expect(api.upload).toHaveBeenCalledTimes(1);
  });
  it('rejects a native file picker result that returns after an account switch', () => {
    component.beginPick(); account.next(2);
    component.choose({target: {files: [new File(['private'], 'private.txt')], value: ''}} as unknown as Event);
    expect(api.upload).not.toHaveBeenCalled();
  });
  it('clears a recovered network error without erasing operation notices', () => {
    component.status = 'library.failed'; component.reload(); expect(component.status).toBe('');
    component.status = 'library.uploaded'; component.reload(); expect(component.status).toBe('library.uploaded');
    component.status = 'library.conflict'; component.reload(); expect(component.status).toBe('library.conflict');
  });
  it('maps permission, stale and quota errors without server data disclosure', () => {
    expect(libraryError(403)).toBe('library.forbidden'); expect(libraryError(409)).toBe('library.conflict');
    expect(libraryError(507)).toBe('library.quota'); expect(libraryError(500)).toBe('library.failed');
  });
});
