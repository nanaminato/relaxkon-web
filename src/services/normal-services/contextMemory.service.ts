import {Injectable} from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class ContextMemoryService{
  public context: Dictionary<ChatContext | undefined> = {

  };
  public getValue(id: number, userId?: number){
    return this.context[`${userId ?? 'guest'}:${id}`];
  }
  public setValue(key: number,value: ChatContext | undefined, userId?: number){
    this.context[`${userId ?? 'guest'}:${key}`] = value;
  }
}
interface Dictionary<T> {
  [key: string]: T;
}
export interface ChatContext{
  pointer: number | undefined;
}
