import {ChatModel} from '../../../models';

export interface ShareMessage { role: 'user' | 'assistant'; content: string; selected: boolean; }

/** Deliberately omit attachments, filenames, parsed file text, system prompts and account metadata. */
export function createShareSnapshot(messages: readonly ChatModel[]): ShareMessage[] {
  return messages.filter(message => message.finish && (message.role === 'user' || message.role === 'assistant') && message.content.trim())
    .map(message => ({role: message.role as 'user' | 'assistant', content: message.content, selected: true}));
}

export function shareText(messages: readonly ShareMessage[], userLabel: string, assistantLabel: string): string {
  return messages.filter(message => message.selected).map(message =>
    `${message.role === 'user' ? userLabel : assistantLabel}\n${message.content}`).join('\n\n────────────────────\n\n');
}
