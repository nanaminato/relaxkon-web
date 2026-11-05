import type {ImageResultResponse} from '../contracts/media';
const imageMimes: Record<string, string> = {png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml'};
export function imageMime(format: string | null = null): string { return imageMimes[format?.toLowerCase() ?? ''] ?? 'image/png'; }
/** Images remain in an img context; never inject returned SVG markup into the DOM. */
export function safeImageSource(source: string | null | undefined): string {
  if (!source) return '';
  if (/^https?:\/\//i.test(source)) {
    try {
      const url = new URL(source);
      return url.username || url.password ? '' : source;
    } catch { return ''; }
  }
  if (/^data:image\/(?:png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/i.test(source)) return source;
  return '';
}
export function imageSource(image: ImageResultResponse, format: string | null = null): string {
  if (image.url) return safeImageSource(image.url);
  if (!image.b64_json) return '';
  if (image.b64_json.startsWith('data:')) return safeImageSource(image.b64_json);
  if (!/^[A-Za-z0-9+/=\s]+$/.test(image.b64_json)) return '';
  return 'data:' + imageMime(format) + ';base64,' + image.b64_json;
}
export function imageExtension(source: string, fallback = 'png'): string {
  const type = /^data:(image\/[^;]+);base64,/i.exec(source)?.[1]?.toLowerCase();
  if (type) return Object.entries(imageMimes).find(([format, mime]) => format !== 'jpg' && mime === type)?.[0] ?? fallback;
  try {
    const suffix = new URL(source).pathname.split('.').pop()?.toLowerCase();
    return suffix && imageMimes[suffix] ? (suffix === 'jpg' ? 'jpeg' : suffix) : fallback;
  } catch { return fallback; }
}
