import {Injectable} from "@angular/core";
import {ChatModel, Configuration, ContentClip, Message, VisionMessage} from "../../models";

@Injectable({providedIn: 'root'})
export class ChatContextHandler {
  handler(back: number | undefined, _configuration: Configuration, chatModels: ChatModel[],
          endPointer: number | undefined): (Message | VisionMessage)[] {
    if (back === undefined) return [];
    return chatModels.filter(message => message.role !== 'system' && (message.role !== 'assistant' || !!message.content) && message.dataId! >= back &&
      (endPointer === undefined || message.dataId! <= endPointer)).map(message => {
      const files = message.role === 'user' ? message.fileList ?? [] : [];
      if (!files.length) return {role: message.role, content: message.content};
      const content: ContentClip[] = [];
      if (message.content) content.push({type: 'text', text: message.content});
      for (const file of files) {
        if (file.fileContent) {
          if (file.fileType?.startsWith('image/')) {
            content.push({type: 'image_url', image_url: {url: file.fileContent}});
          } else {
            content.push({type: 'attachment', attachment: {
              fileName: file.fileName, fileType: file.fileType, fileContent: file.fileContent
            }});
          }
        } else {
          content.push({type: 'text', text: file.parsedContent
            ? 'filename: ' + file.fileName + '\nparsed file content: ' + file.parsedContent
            : 'filename: ' + file.fileName});
        }
      }
      return {role: message.role, content};
    });
  }
}
