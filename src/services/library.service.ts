import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ServiceProvider} from '../roots';
import {LibraryItem, LibrarySnapshot} from '../contracts/library';

/** Private, authenticated server storage; never expose bearer tokens in download URLs. */
@Injectable({providedIn: 'root'})
export class LibraryService {
  private readonly http = inject(HttpClient);
  private readonly provider = inject(ServiceProvider);
  private get url() { return `${this.provider.apiUrl}api/library`; }
  list() { return this.http.get<LibrarySnapshot>(this.url); }
  upload(file: File) {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<LibraryItem>(this.url, form);
  }
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
