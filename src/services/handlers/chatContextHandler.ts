import {Injectable} from "@angular/core";
import {ChatModel, Configuration, ContentClip, Message, VisionMessage} from "../../models";

@Injectable({
  providedIn: "root",
})
export class ChatContextHandler{
  handler(back: number | undefined,
          configuration: Configuration,
          chatModels: ChatModel[],
          endPointer: number | undefined): Message[]|VisionMessage[]{
    let messages: Message[] | VisionMessage[] = [];
    const originalArray = [...chatModels]; // 创建 chatModels 的副本
    const reversedArray = originalArray.reverse();
    let vision = configuration.model.vision;
    for (let chatModel of reversedArray) {
      if (chatModel.role === "system") continue;
      if(endPointer!==undefined && chatModel.dataId!>endPointer!){
        // 如果传递了 结束指针，就跳过结束指针之后的聊天模型对象
        continue;
      }
      if (chatModel.dataId! >= back!) {
        let content = chatModel.content;
        if(chatModel.fileList===undefined||chatModel.fileList.length===0){

        }else{
          for (let file of chatModel.fileList!.filter(f=>!f.fileType?.startsWith("image"))){
            content += `\n filename: ${file.fileName} \n parsed file content: ${file.parsedContent}\n`
              ;
          }
        }

        if(vision){
          let complexContent:ContentClip[] = [];
          complexContent.push({
            type: "text",
            text: content
          })
          if(chatModel.fileList!==undefined){
            let files = chatModel.fileList!.filter(f=>f.fileType?.startsWith("image"));
            for(let img of files){
              complexContent.push({
                type: "image_url",
                image_url: {
                  url: img.fileContent!
                }
              })
            }
          }


          messages.splice(0,0,{
            role: chatModel.role,
            content: complexContent
          })
        }else{
          messages.splice(0, 0, {
            role: chatModel.role,
            content: content
          })
        }

      }
    }
    return messages;
  }
}
