import {TestBed} from '@angular/core/testing';
import {BehaviorSubject, of, Subject} from 'rxjs';
import {LibraryPicker} from './library-picker';
import {LibraryService} from '../../../services/library.service';
import {AuthService} from '../../../auth_module';

describe('Library attachment picker', () => {
  const item = {id: 'one', name: 'notes.txt', size: 4, contentType: 'text/plain', createdAt: '', updatedAt: '', version: 1};
  let auth: {user: {id: number} | undefined; accountId$: BehaviorSubject<number | undefined>};
  let content: Subject<Blob>;
  let service: {list: jasmine.Spy; content: jasmine.Spy};
  let picker: LibraryPicker;
  beforeEach(() => {
    auth = {user: {id: 1}, accountId$: new BehaviorSubject<number | undefined>(1)};
    content = new Subject<Blob>();
    service = {list: jasmine.createSpy().and.returnValue(of({items: [item]})), content: jasmine.createSpy().and.returnValue(content)};
    TestBed.configureTestingModule({providers: [{provide: AuthService, useValue: auth}, {provide: LibraryService, useValue: service}]});
    picker = TestBed.runInInjectionContext(() => new LibraryPicker());
  });
  afterEach(() => picker.ngOnDestroy());
  it('lists metadata without downloading and downloads only explicit selection', () => {
    const selected = jasmine.createSpy(); picker.chosen.subscribe(selected);
    picker.ngOnInit(); expect(service.content).not.toHaveBeenCalled();
    picker.choose(item); picker.choose(item);
    expect(service.content).toHaveBeenCalledTimes(1);
    content.next(new Blob(['test']));
    expect(selected.calls.mostRecent().args[0].name).toBe('notes.txt');
  });
  it('closes on account change and rejects a late download', () => {
    const closed = jasmine.createSpy(); const selected = jasmine.createSpy();
    picker.closed.subscribe(closed); picker.chosen.subscribe(selected); picker.ngOnInit(); picker.choose(item);
    auth.user = {id: 2}; auth.accountId$.next(2); content.next(new Blob(['private']));
    expect(closed).toHaveBeenCalled(); expect(selected).not.toHaveBeenCalled();
  });
  it('cancels an in-flight download when dismissed', () => {
    const selected = jasmine.createSpy(); picker.chosen.subscribe(selected);
    picker.ngOnInit(); picker.choose(item); picker.ngOnDestroy(); content.next(new Blob(['late']));
    expect(selected).not.toHaveBeenCalled();
  });
});
