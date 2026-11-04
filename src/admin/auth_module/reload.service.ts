import type {MessageResponse} from '../../contracts/common';
import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {ServiceProvider} from "../roots";

@Injectable({
  providedIn: "root"
})
export class ReloadService{
  constructor(private http: HttpClient,private provider: ServiceProvider) {
  }
  loadKeys(){
    return this.http.post<MessageResponse>(`${this.provider.apiUrl}api/sync/loadKeys`, {});
  }
}
