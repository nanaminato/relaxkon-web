import {HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpRequest} from '@angular/common/http';
import {inject} from '@angular/core';
import {catchError, Observable, switchMap, throwError} from 'rxjs';
import {AuthService} from '../../auth_module';

const authEndpoint = /\/api\/auth\/(login|refresh|logout|password-reset)(?:$|[/?])/;
const retryHeader = 'X-Access-Token-Retry';

export function jwtInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
  const auth = inject(AuthService);
  if (authEndpoint.test(req.url)) return next(req);

  const authorized = withAccessToken(req, auth.token);
  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 ||
        !auth.refreshToken || req.headers.has(retryHeader)) {
        return throwError(() => error);
      }

      return auth.refreshAccessToken().pipe(
        switchMap(token => next(withAccessToken(req, token).clone({
          setHeaders: { [retryHeader]: '1' }
        })))
      );
    })
  );
}

function withAccessToken(request: HttpRequest<unknown>, token: string | undefined): HttpRequest<unknown> {
  return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
}
