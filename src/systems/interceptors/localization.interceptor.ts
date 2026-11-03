import {HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {LocalizationService} from '../../services/normal-services/localization.service';

/** Applies to ordinary API calls, including login and token refresh. */
export const localizationInterceptor: HttpInterceptorFn = (request, next) => {
  const language = inject(LocalizationService).requestLanguage;
  return next(request.headers.has('Accept-Language') ? request : request.clone({
    setHeaders: {'Accept-Language': language}
  }));
};
