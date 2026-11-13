import {ChatContextHandler} from './chatContextHandler';
import {ChatModel, Configuration} from '../../models';

describe('Chat context defaults', () => {
  it('sends input attachments even when the client vision flag is off', () => {
    const config = {model: {vision: false}} as Configuration;
    const file = {fileName: 'report.pdf', fileType: 'application/pdf', fileContent: 'aA=='};
    const messages = new ChatContextHandler().handler(1, config, [
      new ChatModel('user', 'read', [file], 1),
      new ChatModel('assistant', 'reply', [file], 2),
    ], undefined);
    expect(messages.map(message => message.content)).toEqual([
      [{type: 'text', text: 'read'}, {type: 'attachment', attachment: file}], 'reply'
    ]);
  });

  it('ignores the legacy history cap and image detail while respecting context boundaries', () => {
    const configuration = {
      model: {vision: true}, chatConfiguration: {historySessionLength: 1, detail: 'high'}
    } as unknown as Configuration;
    const chats = [1, 2, 3, 4].map(id => new ChatModel('user', String(id), undefined, id));
    chats[2].fileList = [{fileName: 'image.png', fileType: 'image/png', fileContent: 'data:image/png;base64,aA=='}];
    chats.splice(2, 0, new ChatModel('system', 'Old instruction', undefined, 2.5));
    const messages = new ChatContextHandler().handler(2, configuration, chats, 3);
    expect(messages.length).toBe(2);
    expect(messages[0].content).toBe('2');
    expect(messages[1].content).toEqual([
      {type: 'text', text: '3'}, {type: 'image_url', image_url: {url: 'data:image/png;base64,aA=='}}
    ]);
  });
});
