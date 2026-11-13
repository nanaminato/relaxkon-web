import type {ImageGenerationRequest, ImageOutputFormat, ImageQuality} from '../../../contracts/media';

export const imageModels = ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst', 'gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'] as const;
const standardSizes = ['auto', '1024x1024', '1536x1024', '1024x1536'];
const highResolutionLabels: Readonly<Record<string, string>> = {
  '2560x1440': '2K · 16:9 · 2560×1440',
  '1440x2560': '2K · 9:16 · 1440×2560',
  '3840x2160': '4K · 16:9 · 3840×2160',
  '2160x3840': '4K · 9:16 · 2160×3840'
};
const aspectRatioLabels: Readonly<Record<string, string>> = {
  '1024x1024': '1:1 · 1024×1024',
  '1536x1024': '3:2 · 1536×1024',
  '1024x1536': '2:3 · 1024×1536',
  ...highResolutionLabels
};
const extendedSizes = [...standardSizes, ...Object.keys(highResolutionLabels)];
export function imageCapabilities(model: string) {
  const supportsHighResolution = model === 'gpt-image-2.5-flare' || model === 'gpt-image-2.5-sunburst';
  return {
    known: (imageModels as readonly string[]).includes(model),
    complexity: model.startsWith('gpt-image-2.6-'), promptLimit: 32000,
    sizes: supportsHighResolution ? extendedSizes : standardSizes,
    sizeLabels: supportsHighResolution ? aspectRatioLabels : undefined,
    qualities: ['auto', 'low', 'medium', 'high', 'xhigh', 'max'] as ImageQuality[],
    formats: ['png', 'jpeg', 'webp', 'gif', 'svg'] as ImageOutputFormat[], maxCount: 10
  };
}
function bounded(value: number | null | undefined, fallback: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value! : fallback)));
}
export function normalizeImageRequest(input: ImageGenerationRequest): ImageGenerationRequest {
  const caps = imageCapabilities(input.model ?? '');
  if (!caps.known) throw new Error('unsupported_model');
  const format = caps.formats.includes(input.output_format!) ? input.output_format! : 'png';
  const request: ImageGenerationRequest = {
    model: input.model, prompt: input.prompt.trim(),
    n: bounded(input.n, 1, 1, format === 'svg' ? 1 : caps.maxCount),
    size: format === 'gif' ? 'auto' : caps.sizes.includes(input.size ?? '') ? input.size : caps.sizes[0],
    quality: caps.qualities.includes(input.quality!) ? input.quality : 'auto',
    output_format: format,
    background: input.background === 'transparent' && !['png', 'webp'].includes(format) ? 'auto' : input.background ?? 'auto',
    moderation: input.moderation ?? 'auto'
  };
  if (!request.prompt || request.prompt.length > caps.promptLimit) throw new Error('invalid_prompt');
  if (caps.complexity && input.complexity) request.complexity = input.complexity;
  if (['jpeg', 'webp'].includes(format) && input.output_compression != null)
    request.output_compression = bounded(input.output_compression, 100, 0, 100);
  if (format === 'gif') {
    request.frame_count = bounded(input.frame_count, 8, 2, 16);
    request.frame_duration_ms = bounded(input.frame_duration_ms, 100, 20, 2000);
  }
  return request;
}
