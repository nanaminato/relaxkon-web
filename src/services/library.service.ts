import {inject, Injectable} from '@angular/core';
import {Observable, Subject, catchError, EMPTY, mergeMap} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {ServiceProvider} from '../roots';
import {LibraryItem, LibraryLimits, LibraryRevision, LibrarySnapshot} from '../contracts/library';

/** Private, authenticated server storage; never expose bearer tokens in download URLs. */
@Injectable({providedIn: 'root'})
export class LibraryService {
  private readonly http = inject(HttpClient);
  private readonly provider = inject(ServiceProvider);
  private get url() { return `${this.provider.apiUrl}api/library`; }
  private readonly thumbnailRequests = new Subject<() => Observable<Blob>>();

  constructor() {
    this.thumbnailRequests.pipe(mergeMap(load => load(), 2)).subscribe();
  }

  thumbnail(id: string) {
    return new Observable<Blob>(subscriber => {
      this.thumbnailRequests.next(() => {
        if (subscriber.closed) return EMPTY;
        return new Observable<Blob>(slot => {
          const request = this.content(id).pipe(catchError(() => EMPTY)).subscribe(subscriber);
          request.add(() => slot.complete());
          return request;
        });
      });
    });
  }

  list() { return this.http.get<LibrarySnapshot>(this.url); }
  upload(file: File) {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<LibraryItem>(this.url, form);
  }
  saveDocument(name: string, text: string, item?: LibraryItem) {
    const form = new FormData();
    form.append('file', new Blob([text]), name);
    return item
      ? this.http.put<LibraryItem>(`${this.url}/${encodeURIComponent(item.id)}/document`, form, {params: {version: item.version}})
      : this.http.post<LibraryItem>(`${this.url}/documents`, form);
  }
  revisions(id: string) {
    return this.http.get<LibraryRevision[]>(`${this.url}/${encodeURIComponent(id)}/revisions`);
  }
  revision(id: string, version: number) {
    return this.http.get(`${this.url}/${encodeURIComponent(id)}/revisions/${version}`, {responseType: 'text'});
  }
  textPreview(id: string) {
    return this.http.get<{content: string}>(`${this.url}/${encodeURIComponent(id)}/text-preview`);
  }
  limits() { return this.http.get<LibraryLimits>(`${this.url}/limits`); }
  saveLimits(limits: LibraryLimits) { return this.http.put<LibraryLimits>(`${this.url}/limits`, limits); }
  content(id: string) {
    return this.http.get(`${this.url}/${encodeURIComponent(id)}/content`, {responseType: 'blob'});
  }
  rename(item: LibraryItem, name: string) {
    return this.http.patch<LibraryItem>(`${this.url}/${encodeURIComponent(item.id)}`, {name, version: item.version});
  }
  remove(item: LibraryItem) {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(item.id)}`, {params: {version: item.version}});
  }
}
