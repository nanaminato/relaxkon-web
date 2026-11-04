import {ChatContextHandler} from './chatContextHandler';
import {ChatModel, Configuration, VisionMessage} from '../../models';

describe('Chat context defaults', () => {
  it('ignores the legacy history cap and image detail while respecting context boundaries', () => {
    const configuration = {
      model: {vision: true}, chatConfiguration: {historySessionLength: 1, detail: 'high'}
    } as unknown as Configuration;
    const chats = [1, 2, 3, 4].map(id => new ChatModel('user', String(id), undefined, id));
    chats[2].fileList = [{fileName: 'image.png', fileType: 'image/png', fileContent: 'data:image/png;base64,aA=='}];
    const messages = new ChatContextHandler().handler(2, configuration, chats, 3) as VisionMessage[];
    expect(messages.length).toBe(2);
    expect(messages.map(message => message.content.find(part => part.type === 'text')?.text)).toEqual(['2', '3']);
    expect(messages[1].content.find(part => part.type === 'image_url')?.image_url).toEqual({url: 'data:image/png;base64,aA=='});
  });
});
