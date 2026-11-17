import {ErrorType, ResponseError} from '../../errors';
import {ChatChunk, isChatStreamEvent} from '../../contracts/chat';
const MAX_EVENT_LENGTH = 14 * 1024 * 1024;

export class ChatStreamInterrupted extends Error {}

export async function readChatStream(body: ReadableStream<Uint8Array>, onChunk: (chunk: ChatChunk) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let completed = false;
  try {
    while (true) {
      const {value, done} = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, {stream: true});
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(pending))) {
        const frame = pending.slice(0, boundary.index);
        pending = pending.slice(boundary.index + boundary[0].length);
        const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trimStart()).join('\n');
        if (!data) continue;
        if (data.length > MAX_EVENT_LENGTH) throw new Error('Chat event exceeds size limit');
        const event: unknown = JSON.parse(data);
        if (!isChatStreamEvent(event)) throw new Error('Invalid chat event');
        if (event.type === 'completed') {
          completed = true;
          break;
        }
        if (event.type === 'error') throw {type: ErrorType.Other, code: event.code} satisfies ResponseError;
        onChunk(event.type === 'attachment' ? {attachment: event.attachment} : event.text);
      }
      if (completed) break;
      if (pending.length > MAX_EVENT_LENGTH) throw new Error('Chat event exceeds size limit');
      if (done) throw new ChatStreamInterrupted('Chat stream ended before completion');
    }
  } finally {
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
