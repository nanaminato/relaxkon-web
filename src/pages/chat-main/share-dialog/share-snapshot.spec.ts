import {createShareSnapshot, shareText} from './share-snapshot';
import {ChatModel} from '../../../models';

describe('Conversation share snapshots', () => {
  it('includes only completed user/assistant text, never attachment or hidden metadata', () => {
    const source = [new ChatModel('system', 'secret instruction'), new ChatModel('assistant', 'unfinished', [], 1, false),
      new ChatModel('user', 'Hello', [{fileName: 'secret.txt', fileContent: 'private', parsedContent: 'hidden text'}], 2, true, 'private model')];
    const snapshot = createShareSnapshot(source);
    expect(snapshot).toEqual([{role: 'user', content: 'Hello', selected: true}]);
    expect(shareText(snapshot, 'You', 'Assistant')).toBe('You\nHello');
  });
  it('freezes text independently of later message changes', () => {
    const source = new ChatModel('assistant', 'before');
    const snapshot = createShareSnapshot([source]);
    source.content = 'after';
    expect(snapshot[0].content).toBe('before');
  });
  it('exports only selected messages and preserves code as plain text', () => {
    const snapshot = createShareSnapshot([new ChatModel('user', 'private'), new ChatModel('assistant', '```csharp\nreturn 1;\n```')]);
    snapshot[0].selected = false;
    expect(shareText(snapshot, 'You', 'Assistant')).toBe('Assistant\n```csharp\nreturn 1;\n```');
    snapshot[1].selected = false;
    expect(shareText(snapshot, 'You', 'Assistant')).toBe('');
  });
});
