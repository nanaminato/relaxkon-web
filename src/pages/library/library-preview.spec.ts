import {TestBed} from '@angular/core/testing';
import {TranslateModule} from '@ngx-translate/core';
import {of} from 'rxjs';
import {LibraryPreview} from './library-preview';
import {LibraryService} from '../../services/library.service';

describe('Library document drafts', () => {
  const key = 'relaxkon:library:draft:987654:new';

  beforeEach(() => {
    localStorage.removeItem(key);
    TestBed.configureTestingModule({
      imports: [LibraryPreview, TranslateModule.forRoot()],
      providers: [{provide: LibraryService, useValue: {saveDocument: () => of({})}}],
    });
  });
  afterEach(() => localStorage.removeItem(key));

  function open(accountId: number) {
    const fixture = TestBed.createComponent(LibraryPreview);
    fixture.componentRef.setInput('accountId', accountId);
    fixture.componentRef.setInput('edit', true);
    fixture.detectChanges();
    return fixture;
  }

  it('restores typed content after recreating the editor, isolates accounts, and clears the draft after saving', async () => {
    const first = open(987654);
    await first.whenStable();
    const root: HTMLElement = first.nativeElement;
    const name = root.querySelector<HTMLInputElement>('input[name=name]')!;
    const source = root.querySelector<HTMLTextAreaElement>('textarea')!;
    name.value = 'Draft title';
    name.dispatchEvent(new Event('input'));
    source.value = '## Stored draft';
    source.dispatchEvent(new Event('input'));
    first.destroy();

    const other = open(987655);
    expect(other.componentInstance.text).toBe('');
    other.destroy();

    const reopened = open(987654);
    expect(reopened.componentInstance.name).toBe('Draft title');
    expect(reopened.componentInstance.text).toBe('## Stored draft');
    reopened.componentInstance.save();
    reopened.destroy();

    const afterSave = open(987654);
    expect(afterSave.componentInstance.text).toBe('');
  });
});
