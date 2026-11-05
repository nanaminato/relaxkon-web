export interface ResponseError{
  type: ErrorType,
  error?: string,
  code?: string,
  status?: number
}
export enum ErrorType{
  NotAuthorize,
  NoContent,
  Busy,
  Other
}
