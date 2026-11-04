export interface FileExtractionRequest { fileName: string; fileType?: string | null; fileSize?: number; fileContent: string; }
export interface FileExtractionResponse { content: string; }
