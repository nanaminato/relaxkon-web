import {Injectable} from '@angular/core';

/** One deferred import shared by all conversation messages. Failed loads may retry. */
@Injectable({providedIn: 'root'})
export class MermaidLoaderService {
  private pending?: Promise<void>;

  load(): Promise<void> {
    return this.pending ??= import('mermaid').then(module => {
      (window as unknown as {mermaid: unknown}).mermaid = module.default;
    }).catch(error => {
      this.pending = undefined;
      throw error;
    });
  }
}
