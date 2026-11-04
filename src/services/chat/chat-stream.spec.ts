import {readChatStream} from './chat-stream';

describe('Chat event protocol', () => {
  async function collect(frames: string) {
    const bytes = new TextEncoder().encode(frames);
    const body = new ReadableStream<Uint8Array>({start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    }});
    const result: string[] = [];
    for await (const text of readChatStream(body)) result.push(text);
    return result;
  }
  it('preserves split UTF-8 and multiline text until an explicit completion', async () => {
    expect(await collect('data: {"type":"delta","text":"你好\\n🙂"}\r\n\r\ndata: {"type":"completed"}\r\n\r\n'))
      .toEqual(['你好\n🙂']);
  });
  it('rejects unexpected EOF after a partial answer', async () => {
    await expectAsync(collect('data: {"type":"delta","text":"partial"}\n\n')).toBeRejected();
  });
  it('rejects provider errors and malformed events', async () => {
    await expectAsync(collect('data: {"type":"error","code":"ai_unavailable"}\n\n')).toBeRejected();
    await expectAsync(collect('data: broken\n\n')).toBeRejected();
  });
});
