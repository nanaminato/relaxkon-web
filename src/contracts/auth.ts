export interface LoginRequest { username: string; password: string; deviceName?: string | null; }
export interface RefreshTokenRequest { refreshToken: string; deviceName?: string | null; }
export interface RegisterRequest { username: string; email: string; password: string; confirm: string; }
export interface ChangePasswordRequest { currentPassword: string; newPassword: string; confirmPassword: string; }
export interface PasswordResetRequest { username: string; email: string; }
export interface PasswordResetConfirmationRequest { token: string; newPassword: string; confirmPassword: string; }
export interface TokenResponse {
  token: string; accessToken: string; refreshToken: string; id: number; sessionId: string;
  accessTokenExpiresIn: number; refreshTokenExpiresAt: string;
}
export interface SessionResponse {
  sessionId: string; deviceName: string | null; ipAddress: string | null;
  createdAt: string; lastUsedAt: string; expiresAt: string;
}
export interface CaptchaResponse { img: string; code: string; contentType: string; }
export interface RoleResponse { roleId: number; name: string | null; }
export interface RoleWriteRequest { roleId?: number; name: string; }
export interface RoleReferenceRequest { roleId: number; name?: string | null; }
export interface AccountResponse { accountId: number; username: string | null; email: string | null; userRoles: RoleResponse[]; }
export interface AccountWriteRequest {
  accountId?: number; username: string; email: string; password?: string | null; userRoles?: RoleReferenceRequest[] | null;
}
