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
}
