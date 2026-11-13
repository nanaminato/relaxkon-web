import {inject, Injectable} from "@angular/core";
import {Observable} from "rxjs";
import {RelaxKonService} from "../fetch_services";
import {ChatChunk} from '../../contracts/chat';
import {ChatPacket} from "../../models";

@Injectable({
  providedIn: "root",
})
export class ModelFetchService{
  relaxKonService: RelaxKonService = inject(RelaxKonService);
  public getFetchResponse(
                          param:  ChatPacket,
                          model?: string){
    let subject: Observable<ChatChunk>;
    subject = this.relaxKonService.fetchChat(param as ChatPacket,model);
    return subject!;
  }
}
