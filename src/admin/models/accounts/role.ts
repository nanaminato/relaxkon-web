export interface Role {
  roleId: number; name: string; code?: string; description?: string | null; isSystem?: boolean; memberCount?: number;
}
