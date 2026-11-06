import {retryAfterMs, retryAfterSeconds} from './retry-after';

describe('Retry-After parsing', () => {
  const now = Date.parse('Fri, 06 Nov 2026 12:00:00 GMT');
  it('accepts whole seconds, zero and whitespace', () => {
    expect(retryAfterMs(' 12 ', now)).toBe(12000);
    expect(retryAfterMs('0', now)).toBe(0);
  });
  it('accepts HTTP dates and treats elapsed dates as immediately eligible', () => {
    expect(retryAfterMs('Fri, 06 Nov 2026 12:00:09 GMT', now)).toBe(9000);
    expect(retryAfterMs('Fri, 06 Nov 2026 11:00:00 GMT', now)).toBe(0);
  });
  it('falls back for absent, malformed, negative and fractional values', () => {
    for (const value of [undefined, null, '', ' ', 'invalid', '-1', '1.5', 'Infinity', '1e3', 'Mon, 1'])
      expect(retryAfterMs(value, now)).toBeUndefined();
  });
  it('does not turn huge cooldowns into instant retries or cap daily limits downward', () => {
    expect(retryAfterMs('86400', now)).toBe(86400000);
    expect(retryAfterMs('9'.repeat(400), now)).toBe(Number.MAX_SAFE_INTEGER);
  });
  it('rounds displayed waits up, never inviting an early retry', () => {
    expect(retryAfterSeconds(1001)).toBe(2);
    expect(retryAfterSeconds(0)).toBe(0);
  });
});
