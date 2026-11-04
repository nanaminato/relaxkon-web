import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ServiceProvider} from '../../roots';
import {FileAdds} from '../../models';
import {TtsFile} from '../../models/media';
import type {FileExtractionRequest, FileExtractionResponse} from '../../contracts/files';

@Injectable({providedIn: 'root'})
export class ParseService {
  private readonly http = inject(HttpClient);
  private readonly provider = inject(ServiceProvider);
  parse(file: FileAdds): Observable<FileExtractionResponse> {
    const body: FileExtractionRequest = {fileName: file.fileName, fileType: file.fileType,
      fileSize: file.fileSize, fileContent: file.fileContent ?? ''};
    return this.http.post<FileExtractionResponse>(`${this.provider.apiUrl}api/fileExtractor`, body);
  }
  parseTts(file: TtsFile): Observable<FileExtractionResponse> {
    const body: FileExtractionRequest = {fileName: file.file?.name ?? '', fileType: file.file?.type,
      fileSize: file.file?.size, fileContent: file.fileData ?? ''};
    return this.http.post<FileExtractionResponse>(`${this.provider.apiUrl}api/fileExtractor`, body);
  }
}
