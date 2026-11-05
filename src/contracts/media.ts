export type SpeechFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
export type AudioTranslationFormat = 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
export type AudioTranscriptionFormat = AudioTranslationFormat | 'diarized_json';
export interface SpeechRequest { model?: string; input: string; voice?: string; response_format?: SpeechFormat; speed?: number | null; }
export interface SpeechResponse { base64: string; type: string; }
export interface AudioTranslationRequest {
  file: string; model: string; prompt?: string | null; temperature?: number | null;
  response_format?: AudioTranslationFormat | null; suffix?: string;
}
export interface AudioTranscriptionRequest extends Omit<AudioTranslationRequest, 'response_format'> {
  language?: string | null; response_format?: AudioTranscriptionFormat | null;
}
export interface AudioWordResponse { word: string; start: number; end: number; }
export interface AudioSegmentResponse {
  id: number; seek: number; start: number; end: number; text: string; tokens: number[];
  temperature: number; avg_logprob: number; compression_ratio: number; no_speech_prob: number;
}
export interface AudioTextResponse {
  text: string; language: string | null; duration: number | null;
  segments: AudioSegmentResponse[] | null; words: AudioWordResponse[] | null;
}
export type ImageQuality = 'low' | 'medium' | 'high' | 'auto' | 'xhigh' | 'max';
export type ImageOutputFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'svg';
export interface ImageGenerationRequest {
  model?: string; prompt: string; n?: number; size?: string; quality?: ImageQuality | null;
  background?: 'transparent' | 'opaque' | 'auto' | null; moderation?: 'low' | 'auto' | null;
  complexity?: 'low' | 'medium' | 'high' | null; output_compression?: number | null;
  frame_count?: number | null; frame_duration_ms?: number | null;
  output_format?: ImageOutputFormat | null;
}
export interface ImageResultResponse { url: string | null; b64_json: string | null; revised_prompt: string | null; }
export interface ImageUsageResponse { input_tokens: number; output_tokens: number; total_tokens: number; }
export interface ImageGenerationResponse {
  created: number; data: ImageResultResponse[]; background: string | null;
  output_format: string | null; quality: string | null; size: string | null; usage: ImageUsageResponse | null;
}
export interface APIMartImageItem { url: string[]; expires_at: number; }
export interface APIMartTaskResult { images: APIMartImageItem[]; }
export interface APIMartTaskDetail {
  id: string; status: string; progress: number; result: APIMartTaskResult | null;
  created: number; completed: number; estimated_time: number; actual_time: number;
  error?: {code?: string | number; message?: string; type?: string} | null;
  cost?: number; credits_cost?: number;
  usage?: ImageUsageResponse & {svg_usage?: {model: string; input_tokens: number; output_tokens: number; reasoning_tokens: number}};
}
export interface APIMartTaskResponse { code: number; data: APIMartTaskDetail | null; }

export type APIMartImageModel = 'gpt-image-2.5-flare' | 'gpt-image-2.5-sunburst' | 'gpt-image-2.6-flare' | 'gpt-image-2.6-sunburst' | 'gpt-image-2.5-ext' | 'gpt-image-2.6-ext';
export interface APIMartImageGenerationRequest {
  model: APIMartImageModel; prompt: string; n: number; idempotency_key: string;
  size?: string; resolution?: string; version?: 'flare' | 'sunburst'; quality?: ImageQuality;
  output_format?: ImageOutputFormat; output_compression?: number; background?: 'auto' | 'opaque' | 'transparent';
  moderation?: 'auto' | 'low'; complexity?: 'low' | 'medium' | 'high';
  image_urls?: string[]; mask_url?: string; markup_url?: string;
  frame_count?: number; frame_duration_ms?: number; svg?: {model: string; reasoning?: {effort: string}};
}
export interface APIMartSubmissionResponse {
  code?: number; request_id?: string;
  data?: {task_id?: string; status?: string}[] | {id?: string; status?: string; progress?: number; poll_url?: string} | null;
  error?: {code?: string | number; message?: string; type?: string} | null;
}
