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
export type ImageQuality = 'standard' | 'hd' | 'low' | 'medium' | 'high' | 'auto';
export type ImageOutputFormat = 'png' | 'jpeg' | 'webp';
export interface ImageGenerationRequest {
  model?: string; prompt: string; n?: number; size?: string; quality?: ImageQuality | null;
  background?: 'transparent' | 'opaque' | 'auto' | null; moderation?: 'low' | 'auto' | null;
  output_format?: ImageOutputFormat | null; response_format?: 'url' | 'b64_json'; style?: 'vivid' | 'natural' | null;
}
export interface ImageResultResponse { url: string | null; b64_json: string | null; revised_prompt: string | null; }
export interface ImageUsageResponse { input_tokens: number; output_tokens: number; total_tokens: number; }
export interface ImageGenerationResponse {
  created: number; data: ImageResultResponse[]; background: string | null;
  output_format: string | null; quality: string | null; size: string | null; usage: ImageUsageResponse | null;
}
export interface APIMartGPTImage2Request {
  model?: string; prompt: string; n?: number; size?: string | null; resolution?: string | null;
  image_urls?: string[] | null; official_fallback?: boolean;
}
export interface APIMartGPTImage2OfficialRequest extends Omit<APIMartGPTImage2Request, 'official_fallback'> {
  quality?: string | null; background?: string | null; moderation?: string | null;
  output_format?: string | null; mask_url?: string | null;
}
export interface APIMartTaskError { code: string; message: string; type: string; }
export interface APIMartTaskData { status: string; task_id: string; }
export interface APIMartGenerationResponse { code: number | null; data: APIMartTaskData[] | null; error: APIMartTaskError | null; }
export interface APIMartImageItem { url: string[]; expires_at: number; }
export interface APIMartTaskResult { images: APIMartImageItem[]; }
export interface APIMartTaskDetail {
  id: string; status: string; progress: number; result: APIMartTaskResult | null;
  created: number; completed: number; estimated_time: number; actual_time: number;
}
export interface APIMartTaskResponse { code: number; data: APIMartTaskDetail | null; }
