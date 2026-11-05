/** Translate known role/account errors without exposing backend implementation messages. */
export function roleErrorKey(error: unknown, fallback = 'roleManager.saveError'): string {
  const body = (error as {error?: {code?: string}} | null)?.error;
  const codes = ['invalid_role', 'role_already_exists', 'role_not_found', 'role_code_immutable',
    'system_role_protected', 'invalid_role_assignment', 'last_admin_required', 'account_not_found', 'account_already_exists'];
  return body && codes.includes(body.code ?? '') ? 'roleErrors.' + body.code : fallback;
}
