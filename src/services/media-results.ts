import type {ImageResultResponse} from '../contracts/media';
export function imageSource(image: ImageResultResponse, format: string | null = null): string {
  if (image.url) return image.url;
  if (!image.b64_json) return '';
  if (image.b64_json.startsWith('data:image/')) return image.b64_json;
  const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  return `data:${mime};base64,${image.b64_json}`;
}
