import {Message, VisionMessage} from "../chat-stores/message.model";
export class ChatPacket{
  constructor(public messages: (Message | VisionMessage)[], public conversationId?: string) {
  }
}
