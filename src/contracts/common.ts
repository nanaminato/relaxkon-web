/** HTTP JSON contracts; dates are ISO strings and byte[] values are base64 strings. */
export interface CodeResponse { code: string; }
export interface MessageResponse { msg: string; }
export interface ApiMessageResponse extends CodeResponse { message: string; }
export interface ApiProblemDetails {
  type?: string; title?: string; status?: number; detail?: string; instance?: string;
  code?: string; traceId?: string; errors?: Record<string, string[]>;
}
/** Do not cast untrusted HTTP failures to a successful response. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
  const body = object(error) && 'error' in error ? error['error'] : error;
  if (typeof body === 'string' && body.trim()) return body;
  if (!object(body)) return fallback;
  if (object(body['errors'])) {
    const messages = Object.values(body['errors']).flatMap(value => Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string') : []);
    if (messages.length) return messages.join('\n');
  }
  for (const key of ['message', 'detail', 'title']) {
    const value = body[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
}
