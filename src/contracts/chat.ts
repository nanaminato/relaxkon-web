import type {FileAdds} from '../models/chat-stores/chat.model';

export interface ChatAttachment extends FileAdds {
  fileContent: string;
}
export type ChatChunk = string | {attachment: ChatAttachment};

export type ChatRole = 'system' | 'developer' | 'user' | 'assistant';
export type ChatContentPart = {type: 'text'; text: string} | {type: 'image_url'; image_url: {url: string}}
  | {type: 'attachment'; attachment: ChatAttachment};
export interface ChatMessageRequest { role: ChatRole; content: string | ChatContentPart[]; }
export interface ChatCompletionRequest { model: string; messages: ChatMessageRequest[]; stream?: boolean; vision?: boolean; conversationId?: string; }
export interface ChatModelResponse { modelName: string | null; modelValue: string | null; vision: boolean; }
export type ChatStreamEventResponse = {type: 'delta'; text: string; code?: null}
  | {type: 'attachment'; attachment: ChatAttachment; text?: null; code?: null}
  | {type: 'completed'; text?: null; code?: null} | {type: 'error'; text?: null; code: string};
export function chatRole(value: string): ChatRole {
  if (value === 'system' || value === 'developer' || value === 'user' || value === 'assistant') return value;
  throw new Error('Unsupported chat role');
}

export function isChatStreamEvent(value: unknown): value is ChatStreamEventResponse {
  if (!value || typeof value !== 'object' || !('type' in value)) return false;
  const event = value as Record<string, unknown>;
  switch (event['type']) {
    case 'delta': return typeof event['text'] === 'string' && event['code'] == null;
    case 'attachment': {
      const file = event['attachment'];
      if (!file || typeof file !== 'object') return false;
      const {fileName, fileContent, fileType, fileSize} = file as Partial<ChatAttachment>;
      return typeof fileName === 'string' && typeof fileContent === 'string' &&
        typeof fileType === 'string' && typeof fileSize === 'number';
    }
    case 'completed': return event['text'] == null && event['code'] == null;
    case 'error': return typeof event['code'] === 'string' && event['text'] == null;
    default: return false;
  }
}
