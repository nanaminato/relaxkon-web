import {TranslateService} from '@ngx-translate/core';
import {inject, Injectable} from "@angular/core";
import {ChatHistory, ChatHistoryTitle, ChatInterface} from "../models";
import {SendService} from "./send.service";
import {GenerateTask} from "../models/media";

@Injectable({
  providedIn: "root"
})
export class SendManagerService{
  readonly i18n = inject(TranslateService);
  sendService = inject(SendService);
  sendHistory(chatHistory: ChatHistoryTitle): Promise<string>{
    return new Promise((resolve,reject)=>{
      this.sendService.sendHistory(chatHistory)
        .subscribe({
          next: (msg:any)=>{
            resolve(this.i18n.instant('management.syncSuccess'))
          },
          error: err => {
            reject()
          }
        })
    });
  }
  sendMessage(historyDataId: number,chatMessage: ChatInterface): Promise<string>{
    return new Promise((resolve,reject)=>{
      this.sendService.sendMessage(historyDataId,chatMessage)
        .subscribe({
          next: (msg:any)=>{
            resolve(this.i18n.instant('management.messageUploaded'))
          },
          error: err => {
            reject()
          }
        })
    });
  }
  sendTask(task: GenerateTask): Promise<string>{
    return new Promise((resolve,reject)=>{
      this.sendService.sendTask(task)
        .subscribe({
          next: (msg:any)=>{
            resolve(this.i18n.instant('management.taskUploaded'))
          },
          error: err => {
            reject()
          }
        })
    });
  }
  updateHistory(chatHistory: ChatHistory): Promise<string>{
    return new Promise((resolve,reject)=>{
      this.sendService.updateHistory(chatHistory)
        .subscribe({
          next: (msg:any)=>{
            resolve(this.i18n.instant('management.historyUpdated'))
          },
          error: err => {
            reject()
          }
        })
    });
  }
  updateMessage(historyDataId: number,chatMessage: ChatInterface): Promise<string>{
    return new Promise((resolve,reject)=>{
      this.sendService.updateMessage(historyDataId,chatMessage)
        .subscribe({
          next: (msg:any)=>{
            resolve(this.i18n.instant('management.messageUpdated'))
          },
          error: err => {
            reject()
          }
        })
    });
  }
  updateTask(task: GenerateTask): Promise<string>{
    return new Promise((resolve,reject)=>{
      this.sendService.updateTask(task)
        .subscribe({
          next: (msg:any)=>{
            resolve(this.i18n.instant('management.taskUpdated'))
          },
          error: err => {
            reject()
          }
        })
    });
  }
  deleteHistory(historyDataId: number): Promise<string>{
    return new Promise((resolve,reject)=>{
      this.sendService.deleteHistory(historyDataId)
        .subscribe({
          next: (msg:any)=>{
            resolve(this.i18n.instant('management.historyDeleted'))
          },
          error: err => {
            reject()
          }
        })
    });
  }
  deleteMessage(historyDataId: number, messageDataId: number): Promise<string>{
    return new Promise((resolve,reject)=>{
      this.sendService.deleteMessage(historyDataId,messageDataId)
        .subscribe({
          next: (msg:any)=>{
            resolve(this.i18n.instant('management.messageDeleted'))
          },
          error: err => {
            reject()
          }
        })
    })
  }
  deleteTask(taskId: string): Promise<string>{
    return new Promise((resolve,reject)=>{
      this.sendService.deleteTask(taskId)
        .subscribe({
          next: (msg:any)=>{
            resolve(this.i18n.instant('management.taskDeleted'))
          },
          error: err => {
            reject()
          }
        })
    })
  }
}
