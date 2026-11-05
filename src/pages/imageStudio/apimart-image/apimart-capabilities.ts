import type {APIMartImageGenerationRequest, APIMartImageModel, APIMartSubmissionResponse, APIMartTaskDetail, APIMartTaskResponse, ImageOutputFormat} from '../../../contracts/media';
import {safeImageSource} from '../../../services/media-results';
export const apimartModels: APIMartImageModel[] = ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst', 'gpt-image-2.6-flare', 'gpt-image-2.6-sunburst', 'gpt-image-2.5-ext', 'gpt-image-2.6-ext'];
const ratios = ['1:1', '3:2', '2:3', '4:3', '3:4', '5:4', '4:5', '16:9', '9:16', '2:1', '1:2', '21:9', '9:21', '3:1', '1:3'];
const extRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'];
export function apimartCapabilities(model: APIMartImageModel) {
  const ext = model.endsWith('-ext'), v26 = model.startsWith('gpt-image-2.6');
  return {ext, v26, quality: !ext || v26, mask: !ext, markup: !ext && v26,
    formats: (v26 ? ['png', 'jpeg', 'webp', 'gif', 'svg'] : ext ? ['png'] : ['png', 'jpeg', 'webp']) as ImageOutputFormat[],
    ratios: ext ? extRatios : ratios, resolutions: ext && v26 ? ['1k'] : ext ? ['1K', '2K', '4K'] : ['1k', '2k', '4k'],
    maxCount: ext && v26 ? 1 : 4};
}
export function publicImageUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try { const url = new URL(value); return !url.username && !url.password && !!url.hostname; } catch { return false; }
}
export function validExactSize(value: string): boolean {
  const match = /^(\d{2,4})x(\d{2,4})$/.exec(value);
  if (!match) return false;
  const [width, height] = [Number(match[1]), Number(match[2])];
  return width % 16 === 0 && height % 16 === 0 && Math.max(width, height) <= 3840 &&
    Math.max(width, height) <= 3 * Math.min(width, height) && width * height >= 655360 && width * height <= 8294400;
}
/** Explicit capability allowlist: ignored/unsupported controls never enter the wire request. */
export function apimartRequest(input: APIMartImageGenerationRequest): APIMartImageGenerationRequest {
  if (!apimartModels.includes(input.model)) throw new Error('apimartStudio.invalidModel');
  const caps = apimartCapabilities(input.model), format = input.output_format ?? 'png';
  if (!input.prompt.trim() || input.prompt.trim().length > 32000) throw new Error('apimartStudio.invalidPrompt');
  if (!Number.isInteger(input.n) || input.n < 1 || input.n > caps.maxCount || (format === 'svg' && input.n !== 1)) throw new Error('apimartStudio.invalidCount');
  if (!caps.formats.includes(format)) throw new Error('apimartStudio.invalidOptions');
  if (input.resolution && !caps.resolutions.includes(input.resolution)) throw new Error('apimartStudio.invalidOptions');
  if (input.size && input.size !== 'auto' && !caps.ratios.includes(input.size) && (caps.ext || !validExactSize(input.size))) throw new Error('apimartStudio.invalidSize');
  const refs = input.image_urls ?? [];
  if (refs.length > 16 || refs.some(url => !publicImageUrl(url) && !(caps.ext && /^data:image\/(png|jpeg|webp|gif|bmp);base64,[A-Za-z0-9+/=\s]+$/i.test(url)))) throw new Error('apimartStudio.invalidReferences');
  if (['gif', 'svg'].includes(format) && (refs.length || input.mask_url || input.markup_url)) throw new Error('apimartStudio.textOnly');
  if (input.mask_url && input.markup_url) throw new Error('apimartStudio.overlayConflict');
  for (const [kind, value] of [['mask', input.mask_url], ['markup', input.markup_url]] as const) {
    if (value && (!refs.length || !caps[kind] || (!(publicImageUrl(value) && (kind !== 'markup' || /^https:\/\//i.test(value))) && !/^data:image\/png;base64,[A-Za-z0-9+/=\s]+$/i.test(value)))) throw new Error('apimartStudio.invalidOverlay');
  }
  const body: APIMartImageGenerationRequest = {model: input.model, prompt: input.prompt.trim(), n: input.n, idempotency_key: input.idempotency_key};
  if (input.size) body.size = format === 'gif' ? 'auto' : input.size;
  if (format === 'gif') body.size = 'auto';
  if (input.resolution && format !== 'gif' && !/x/.test(input.size ?? '')) body.resolution = input.resolution;
  if (caps.ext) body.version = input.version === 'sunburst' ? 'sunburst' : 'flare';
  if (refs.length) body.image_urls = [...refs];
  if (caps.quality) body.quality = input.quality ?? 'medium';
  if (!caps.ext || caps.v26) body.output_format = format;
  if (caps.v26 && input.complexity) body.complexity = input.complexity;
  if (!caps.ext) {
    if (format !== 'svg') body.background = input.background ?? 'auto';
    if (body.background === 'transparent' && !['png', 'webp'].includes(format)) throw new Error('apimartStudio.invalidOptions');
    body.moderation = input.moderation ?? 'auto';
    if (['jpeg', 'webp'].includes(format) && input.output_compression != null) {
      if (!Number.isInteger(input.output_compression) || input.output_compression < 0 || input.output_compression > 100) throw new Error('apimartStudio.invalidOptions');
      body.output_compression = input.output_compression;
    }
    if (input.mask_url) body.mask_url = input.mask_url;
    if (input.markup_url) body.markup_url = input.markup_url;
    if (format === 'gif') {
      if (!Number.isInteger(input.frame_count) || input.frame_count! < 2 || input.frame_count! > 16 ||
        !Number.isInteger(input.frame_duration_ms) || input.frame_duration_ms! < 20 || input.frame_duration_ms! > 2000) throw new Error('apimartStudio.invalidOptions');
      body.frame_count = input.frame_count; body.frame_duration_ms = Math.round(input.frame_duration_ms! / 10) * 10;
    }
  }
  if (format === 'svg') {
    if (!caps.ext && !input.svg?.model.trim()) throw new Error('apimartStudio.svgRequired');
    if (input.svg?.model.trim()) body.svg = {model: input.svg.model.trim()};
  }
  return body;
}
export function submissionTaskIds(response: APIMartSubmissionResponse): string[] {
  if (response.code != null && ![200, 202].includes(response.code)) throw new Error('apimartStudio.submitUnknown');
  const values = Array.isArray(response.data) ? response.data.map(item => item.task_id) : [response.data?.id];
  if (!values.length || values.some(id => typeof id !== 'string' || !id.trim() || id.length > 255 || /[\x00-\x1f]/.test(id))) throw new Error('apimartStudio.submitUnknown');
  return [...new Set(values.map(id => id!.trim()))];
}
export function submissionTaskId(response: APIMartSubmissionResponse): string { return submissionTaskIds(response)[0]; }
export function taskDetail(response: APIMartTaskResponse | APIMartTaskDetail, taskId: string): APIMartTaskDetail {
  if ('code' in response && response.code !== 200) throw new Error('apimartStudio.queryError');
  const task = 'data' in response ? response.data : response;
  if (!task || task.id !== taskId || !['pending', 'submitted', 'queued', 'processing', 'completed', 'failed', 'cancelled'].includes(task.status)) throw new Error('apimartStudio.queryError');
  return task;
}
export function taskImages(task: APIMartTaskDetail): string[] {
  return [...new Set((task.result?.images ?? []).flatMap(image => image.url ?? []).map(safeImageSource).filter(Boolean))];
}
