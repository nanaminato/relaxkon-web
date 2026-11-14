import {Component, DestroyRef, OnInit, inject, input, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {LibraryService} from '../../services/library.service';

@Component({
  selector: 'app-library-thumbnail',
  template: `
    @if (url(); as src) {
      <img [src]="src" alt="" (error)="clear()">
    } @else {
      <span aria-hidden="true">▧</span>
    }
  `,
  styles: [`
    :host { display: grid; place-items: center; width: 100%; height: 100%; }
    img { display: block; width: 100%; height: 100%; min-height: 0; object-fit: contain; }
    span { font-size: 32px; color: var(--app-text-muted, #64748b); }
  `],
})
export class LibraryThumbnail implements OnInit {
  readonly id = input.required<string>();
  readonly url = signal('');
  private readonly api = inject(LibraryService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.destroyRef.onDestroy(() => this.clear());
    this.api.thumbnail(this.id()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => this.url.set(URL.createObjectURL(blob)),
      error: () => this.clear(),
    });
  }

  clear() {
    const url = this.url();
    if (url) URL.revokeObjectURL(url);
    this.url.set('');
  }
}
