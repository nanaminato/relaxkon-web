import {ShowType} from "../enumerates";

export const UserRole = "user";
export const AssistantRole = "assistant";
export interface FileAdds {
  fileName: string;
  fileType?: string;
  fileSize?: number;
  fileContent?: string;//bs64
  parsedContent?: string;
}
export class ChatModel {

  public markAsChanged = false;
  constructor(public role: string = 'user',
              public content: string = '',
              public fileList?:FileAdds[],
              public dataId?: number,
              public finish: boolean = true,
              public model?: string) {
    if(dataId==null){
      this.dataId = Date.now() * 1000 + Math.floor(Math.random() * 500) ;
    }
  }
  public reRandom(){
    const id = Math.floor(this.dataId! / 1000) * 1000;
    const random = Math.floor(Math.random()*500);
    this.dataId = id + (random <500 ? 500 : 499+random);
  }

}
export interface ChatInterface{
  role: string;
  content?: string
  fileList?: FileAdds[];
  dataId: number;
  finish: boolean;
  model?: string;
}
