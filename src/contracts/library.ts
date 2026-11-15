export interface LibraryItem {
  id: string;
  name: string;
  contentType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}
export interface LibrarySnapshot {
  items: LibraryItem[];
  usedBytes: number;
  maxBytes: number;
  maxFileBytes: number;
  maxFiles: number;
  historyUsedBytes?: number;
  maxHistoryBytes?: number;
}

export const libraryDocumentType = 'text/vnd.relaxkon.document+markdown';
export interface LibraryLimits {
  maxBytes: number;
  maxFileBytes: number;
  maxHistoryBytes?: number;
}

export interface LibraryAdminLimits extends LibraryLimits {
  usedBytes?: number;
  historyUsedBytes?: number;
}

export interface LibraryRevision {
  version: number;
  name: string;
  updatedAt: string;
}
