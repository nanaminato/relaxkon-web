import {Injectable} from '@angular/core';

@Injectable({providedIn: 'root'})
export class ImageSyncPreferences {
  get download() { return localStorage.getItem('imageSync.download') !== 'off'; }
  set download(enabled: boolean) { localStorage.setItem('imageSync.download', enabled ? 'on' : 'off'); }
  get upload() { return localStorage.getItem('imageSync.upload') !== 'off'; }
  set upload(enabled: boolean) { localStorage.setItem('imageSync.upload', enabled ? 'on' : 'off'); }
}
