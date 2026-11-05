import {Component, ElementRef, Input, ViewChild} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {UrlImage} from '../../../models/images';
import {imageExtension, safeImageSource} from '../../../services/media-results';

@Component({
  selector: 'app-gallery', standalone: true, imports: [TranslateModule],
  templateUrl: './gallery.html', styleUrls: ['./gallery.scss']
})
export class Gallery {
  @Input() loading = false;
  @Input() images: UrlImage[] | undefined = [];
  @ViewChild('viewer') viewer?: ElementRef<HTMLDialogElement>;
  selected?: UrlImage;
  selectedIndex = 0;
  downloadError = false;
  downloading = new Set<UrlImage>();
  failed = new Set<UrlImage>();
  source(image: UrlImage) { return safeImageSource(image.image_url); }
  open(image: UrlImage, index: number) {
    if (!this.source(image)) return;
    this.selected = image; this.selectedIndex = index;
    this.viewer?.nativeElement.showModal();
  }
  close() { this.viewer?.nativeElement.close(); this.selected = undefined; }
  async download(image: UrlImage, index: number) {
    const source = this.source(image);
    if (!source || this.downloading.has(image)) return;
    this.downloading.add(image); this.downloadError = false;
    let objectUrl: string | undefined;
    try {
      const response = await fetch(source, {credentials: 'omit', referrerPolicy: 'no-referrer'});
      if (!response.ok) throw new Error('image_download_failed');
      const blob = await response.blob();
      const extensions: Record<string, string> = {'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg'};
      const extension = extensions[blob.type.split(';')[0]];
      if (!extension) throw new Error('unsupported_image_type');
      objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'turbo-image-' + (index + 1) + '.' + extension;
      document.body.appendChild(link); link.click(); link.remove();
    } catch { this.downloadError = true; }
    finally {
      this.downloading.delete(image);
      if (objectUrl) { const url = objectUrl; setTimeout(() => URL.revokeObjectURL(url), 10000); }
    }
  }
  format(image: UrlImage) { return imageExtension(this.source(image), image.image_type === 'any' ? 'png' : image.image_type ?? 'png').toUpperCase(); }
}
