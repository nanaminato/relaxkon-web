export function libraryError(status: number): string {
  return ({401: 'library.signIn', 403: 'library.forbidden', 404: 'library.missing', 409: 'library.conflict',
    413: 'library.tooLarge', 429: 'library.tryLater', 507: 'library.quota'} as Record<number, string>)[status] ?? 'library.failed';
}
