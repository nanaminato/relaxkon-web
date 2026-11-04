export async function* readChatStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
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
        const event: unknown = JSON.parse(data);
        if (!event || typeof event !== 'object' || !('type' in event)) throw new Error('Invalid chat event');
        if (event.type === 'completed') return;
        if (event.type === 'error') throw new Error('Chat stream failed');
        if (event.type !== 'delta' || !('text' in event) || typeof event.text !== 'string')
          throw new Error('Invalid chat event');
        yield event.text;
      }
      if (pending.length > 1024 * 1024) throw new Error('Chat event exceeds size limit');
      if (done) throw new Error('Chat stream ended before completion');
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
