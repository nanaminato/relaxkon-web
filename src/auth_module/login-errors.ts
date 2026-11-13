import {HttpErrorResponse} from '@angular/common/http';

/** The server sends delta seconds; never display arbitrary response text. */
export function loginRetrySeconds(error: HttpErrorResponse): number {
  const value = Number(error.headers.get('Retry-After'));
  return Number.isFinite(value) && value > 0 ? Math.min(86400, Math.ceil(value)) : 60;
}
