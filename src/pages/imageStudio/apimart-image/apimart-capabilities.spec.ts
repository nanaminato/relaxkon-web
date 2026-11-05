import {apimartCapabilities, apimartModels, apimartRequest, submissionTaskId, taskDetail, taskImages, validExactSize} from './apimart-capabilities';
import type {APIMartImageGenerationRequest, APIMartTaskDetail} from '../../../contracts/media';
describe('APIMart capability protocol', () => {
  const base = (): APIMartImageGenerationRequest => ({model: 'gpt-image-2.5-flare', prompt: ' image ', n: 1, idempotency_key: 'operation'});
  it('only exposes 2.5/2.6 model families and keeps Ext 2.5 limited to documented fields', () => {
    expect(apimartModels.length).toBe(6);
    expect(apimartModels.every(model => /gpt-image-2\.[56]-/.test(model))).toBeTrue();
    const request = apimartRequest({...base(), model: 'gpt-image-2.5-ext', version: 'sunburst', size: '16:9', resolution: '2K',
      quality: 'max', output_format: 'png', complexity: 'high', background: 'transparent', moderation: 'low', output_compression: 100});
    expect(request).toEqual({model: 'gpt-image-2.5-ext', prompt: 'image', n: 1, idempotency_key: 'operation', version: 'sunburst', size: '16:9', resolution: '2K'});
  });
  it('enforces currently available Ext 2.6 resolution/count and omits ignored background/compression', () => {
    expect(apimartCapabilities('gpt-image-2.6-ext').resolutions).toEqual(['1k']);
    for (const patch of [{n: 2}, {resolution: '2k'}, {size: '1024x1024'}])
      expect(() => apimartRequest({...base(), model: 'gpt-image-2.6-ext', ...patch})).toThrow();
    const request = apimartRequest({...base(), model: 'gpt-image-2.6-ext', output_format: 'gif', resolution: '1k', size: 'auto',
      frame_count: 8, frame_duration_ms: 200, background: 'transparent', output_compression: 50});
    expect(request.frame_count).toBeUndefined(); expect(request.frame_duration_ms).toBeUndefined();
    expect(request.background).toBeUndefined(); expect(request.output_compression).toBeUndefined();
  });
  it('distinguishes required standard SVG author model from optional Ext configuration', () => {
    expect(() => apimartRequest({...base(), model: 'gpt-image-2.6-flare', output_format: 'svg'})).toThrowError('apimartStudio.svgRequired');
    const svg = apimartRequest({...base(), model: 'gpt-image-2.6-flare', output_format: 'svg', svg: {model: 'gpt-5.4-mini'}, background: 'transparent'});
    expect(svg.svg).toEqual({model: 'gpt-5.4-mini'}); expect(svg.background).toBeUndefined();
    expect(apimartRequest({...base(), model: 'gpt-image-2.6-ext', output_format: 'svg'}).svg).toBeUndefined();
    expect(() => apimartRequest({...base(), model: 'gpt-image-2.5-flare', output_format: 'svg'})).toThrow();
  });
  it('enforces references, masks, markup and text-only formats without silently dropping edits', () => {
    const refs = ['https://image.example.invalid/first.png'];
    expect(() => apimartRequest({...base(), image_urls: ['data:image/png;base64,AQID']})).toThrow();
    expect(apimartRequest({...base(), model: 'gpt-image-2.5-ext', image_urls: ['data:image/png;base64,AQID']}).image_urls?.length).toBe(1);
    expect(() => apimartRequest({...base(), image_urls: refs, mask_url: refs[0], markup_url: refs[0]})).toThrow();
    expect(() => apimartRequest({...base(), model: 'gpt-image-2.6-flare', output_format: 'gif', image_urls: refs})).toThrow();
    expect(() => apimartRequest({...base(), model: 'gpt-image-2.6-ext', image_urls: refs, mask_url: refs[0]})).toThrow();
    expect(() => apimartRequest({...base(), image_urls: ['https://user:password@image.example.invalid/a.png']})).toThrow();
    const editing = apimartRequest({...base(), model: 'gpt-image-2.6-flare', image_urls: refs, markup_url: refs[0], resolution: '2k'});
    expect(editing.size).toBeUndefined(); expect(editing.markup_url).toBe(refs[0]);
  });
  it('validates exact dimension geometry and safe GIF defaults', () => {
    expect(validExactSize('1600x1200')).toBeTrue();
    for (const value of ['1:1', '1601x1200', '4096x4096', '128x128', '3840x512']) expect(validExactSize(value)).toBeFalse();
    expect(() => apimartRequest({...base(), n: NaN})).toThrow();
    const gif = apimartRequest({...base(), model: 'gpt-image-2.6-sunburst', output_format: 'gif', size: 'auto', frame_count: 9, frame_duration_ms: 201});
    expect(gif.frame_duration_ms).toBe(200); expect(gif.size).toBe('auto');
  });
  it('requires HTTPS for markup while preserving HTTP reference and mask compatibility', () => {
    const edited = {...base(), model: 'gpt-image-2.6-flare' as const, image_urls: ['http://example.invalid/reference.png']};
    expect(() => apimartRequest({...edited, markup_url: 'http://example.invalid/markup.png'})).toThrowError('apimartStudio.invalidOverlay');
    expect(apimartRequest({...edited, markup_url: 'https://example.invalid/markup.png'}).markup_url).toContain('https://');
    expect(apimartRequest({...edited, mask_url: 'http://example.invalid/mask.png'}).mask_url).toContain('http://');
  });
  it('reads both submission shapes without ever following provider poll URLs', () => {
    expect(submissionTaskId({code: 200, data: [{task_id: 'task/a', status: 'submitted'}]})).toBe('task/a');
    expect(submissionTaskId({code: 202, data: {id: 'task/a', poll_url: 'https://untrusted.invalid/'}})).toBe('task/a');
    for (const response of [{code: 500, data: [{task_id: 'not-accepted'}]}, {code: 200, data: []}]) expect(() => submissionTaskId(response)).toThrow();
  });
  it('checks task identity and flattens all safe result URLs', () => {
    const task = {id: 'one', status: 'completed', result: {images: [
      {url: ['https://image.example.invalid/one.png', 'javascript:alert(1)']}, {url: ['https://image.example.invalid/two.svg']}
    ]}} as APIMartTaskDetail;
    expect(taskDetail({code: 200, data: task}, 'one')).toBe(task);
    expect(taskDetail(task, 'one')).toBe(task);
    expect(() => taskDetail(task, 'other')).toThrow();
    expect(taskImages(task)).toEqual(['https://image.example.invalid/one.png', 'https://image.example.invalid/two.svg']);
  });
});
