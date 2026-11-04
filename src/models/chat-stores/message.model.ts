export interface Message{
  role: string,
  content: string
}
export interface VisionMessage{
  role: string;
  content: ContentClip[]
}
export interface ContentClip{
  type: string;
  text?:string;
  image_url?: VisionImage;
}
export interface VisionImage{
  url: string;
}
