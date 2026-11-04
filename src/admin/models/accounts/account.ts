import type {Role} from './role';
/** Normalized display data, never a password-bearing write request. */
export interface Account { accountId: number; username: string; email: string; userRoles: Role[]; }
