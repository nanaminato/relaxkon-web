import type {ChatContentPart} from '../../contracts/chat';
export interface Message { role: string; content: string; }
export interface VisionMessage { role: string; content: ChatContentPart[]; }
export type ContentClip = ChatContentPart;
export interface VisionImage { url: string; }
