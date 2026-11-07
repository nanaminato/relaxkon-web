import {AuthService} from '../../auth_module/auth.service';
import {inject, Injectable} from "@angular/core";
import {ChatHistory, ChatHistoryModel, ChatListModel, ChatModel} from "../../models";
import {DbService} from "./db.service";

@Injectable({
  providedIn: "root"
})
export class ChatDataService{
  dbService = inject(DbService);
  private readonly auth = inject(AuthService);
  async getChatHistory(dataId: number): Promise<ChatHistoryModel | undefined> {
    try {
      const owner = this.auth.user?.id;
      const data = await this.dbService.getHistory(dataId, owner) ?? await this.dbService.getHistory(dataId);
      if(!data) return undefined;
      let list = (data!.chatList.map(async (chatModelId) => {
        let chatInterface = await this.dbService.getChatInterface(chatModelId, dataId, data.userId);
        if(chatInterface === undefined) return undefined;
        return new ChatModel(
          chatInterface.role,
          chatInterface.content,
          chatInterface.fileList,
          chatInterface.dataId,
          true,
          chatInterface.model
        )
      }));

      return await Promise.all(list).then(chatModels=>{
        const list: ChatModel[] = chatModels.filter(d => d !== undefined) as ChatModel[];
        return new ChatHistoryModel(
          data.title,
          new ChatListModel(
            data.dataId,
            list
          ),
          data.dataId,
          data.userId
        );
      })
    } catch (error) {
      // Handle errors, log or throw if necessary
      console.error('Error fetching chat history:', error);
      throw error; // Propagate the error or handle it according to your needs
    }
  }
  async deleteHistoriesByTitleId(titleId: number, userId?: number) {
    await this.dbService.deleteSession(titleId, userId);
  }

  async putHistory(history: ChatHistoryModel) {
    if (!history) return;
    // Capture the draft before awaiting: callers may continue streaming or switch sessions.
    const messages = structuredClone((history.chatList?.chatModel ?? []).map(chat => ({
      role: chat.role, content: chat.content, fileList: chat.fileList,
      dataId: chat.dataId!, finish: chat.finish, model: chat.model
    })));
    await this.dbService.saveSession({
      title: history.title, dataId: history.dataId!,
      chatList: messages.map(chat => chat.dataId), userId: history.userId
    }, messages, this.auth.user?.id);
  }

  deleteChatModel(id: number, historyId: number, userId?: number) {
    return this.dbService.deleteChatInterface(id, historyId, userId);
  }
}
