import {imageCapabilities, normalizeImageRequest} from './image-capabilities';
import {imageSource, safeImageSource, imageExtension} from '../../../services/media-results';

describe('Image model capabilities and safe formats', () => {
  it('exposes only the retained current image families and omits unrelated options', () => {
    expect(imageCapabilities('gpt-image-2').known).toBeFalse();
    expect(imageCapabilities('dall-e-3').known).toBeFalse();
    const input = {model: 'gpt-image-2.5-flare', prompt: 'image', complexity: 'high' as const,
      style: 'natural', response_format: 'url', frame_count: 12};
    const request = normalizeImageRequest(input);
    expect(request.complexity).toBeUndefined(); expect('style' in request).toBeFalse();
    expect('response_format' in request).toBeFalse(); expect(request.frame_count).toBeUndefined();
  });
  it('offers landscape and portrait 2K and 4K only for the 2.5 models', () => {
    const largeSizes = ['2560x1440', '1440x2560', '3840x2160', '2160x3840'];
    for (const model of ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst']) {
      for (const size of largeSizes) {
        expect(imageCapabilities(model).sizes).toContain(size);
        expect(normalizeImageRequest({model, prompt: 'image', size}).size).toBe(size);
      }
    }
    for (const model of ['gpt-image-2.6-flare', 'gpt-image-2.6-sunburst']) {
      expect(imageCapabilities(model).sizes).toEqual(['auto', '1024x1024', '1536x1024', '1024x1536']);
      expect(normalizeImageRequest({model, prompt: 'image', size: '3840x2160'}).size).toBe('auto');
    }
  });
  it('supports newer quality levels and constrains animation/vector output', () => {
    expect(imageCapabilities('gpt-image-2.5-flare').qualities).toContain('max');
    const gif = normalizeImageRequest({model: 'gpt-image-2.6-flare', prompt: 'image', output_format: 'gif',
      quality: 'xhigh', background: 'transparent', output_compression: 50, complexity: 'high',
      n: NaN, size: '1024x1024', frame_count: Infinity, frame_duration_ms: 0});
    expect(gif).toEqual({model: 'gpt-image-2.6-flare', prompt: 'image', n: 1, size: 'auto', quality: 'xhigh',
      output_format: 'gif', background: 'auto', moderation: 'auto', complexity: 'high', frame_count: 8, frame_duration_ms: 20});
    const svg = normalizeImageRequest({model: 'gpt-image-2.6-sunburst', prompt: 'image', output_format: 'svg', n: 8});
    expect(svg.n).toBe(1); expect(svg.frame_count).toBeUndefined(); expect(svg.output_compression).toBeUndefined();
    const jpeg = normalizeImageRequest({model: 'gpt-image-2.6-flare', prompt: 'image', output_format: 'jpeg', output_compression: NaN});
    expect(jpeg.output_compression).toBe(100);
  });
  it('rejects unsupported models and oversize/empty prompts', () => {
    expect(() => normalizeImageRequest({model: 'unknown', prompt: 'image'})).toThrow();
    expect(() => normalizeImageRequest({model: 'gpt-image-2.5-flare', prompt: 'x'.repeat(32001)})).toThrow();
    expect(() => normalizeImageRequest({model: 'gpt-image-2.5-flare', prompt: ' '})).toThrow();
  });
  it('keeps GIF and SVG in safe image sources and uses accurate MIME and file extensions', () => {
    const image = {url: null, b64_json: 'AQID', revised_prompt: null};
    expect(imageSource(image, 'gif')).toBe('data:image/gif;base64,AQID');
    expect(imageSource(image, 'svg')).toBe('data:image/svg+xml;base64,AQID');
    expect(imageExtension(imageSource(image, 'svg'))).toBe('svg');
    expect(safeImageSource('javascript:alert(1)')).toBe('');
    expect(safeImageSource('https://user:secret@images.example.invalid/a.png')).toBe('');
    expect(safeImageSource('data:text/html;base64,AQID')).toBe('');
    expect(imageSource({...image, b64_json: 'data:image/svg+xml,<svg onload=alert(1)>'}, 'svg')).toBe('');
    expect(safeImageSource('https://images.example.invalid/a.gif')).toContain('https://');
  });
});
