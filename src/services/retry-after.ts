/** Retry-After is either whole seconds or an HTTP date. Never shorten a server cooldown. */
export function retryAfterMs(value: string | null | undefined, now = Date.now()): number | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (/^\d+$/.test(raw)) {
    // Saturating prevents a malicious/overflowing value becoming an immediate retry.
    return Math.min(Number(raw) * 1000, Number.MAX_SAFE_INTEGER);
  }
  // Accept the three HTTP-date formats, not Date.parse's loose numeric/date shorthand.
  const httpDate = /^(?:[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT|[A-Za-z]+, \d{2}-[A-Za-z]{3}-\d{2} \d{2}:\d{2}:\d{2} GMT|[A-Za-z]{3} [A-Za-z]{3} [ \d]\d \d{2}:\d{2}:\d{2} \d{4})$/;
  if (!httpDate.test(raw)) return undefined;
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}

export function retryAfterSeconds(delayMs: number): number {
  return Math.max(0, Math.ceil(delayMs / 1000));
}
