import {Component, HostListener} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {TranslatePipe} from '@ngx-translate/core';
import {NzIconDirective} from 'ng-zorro-antd/icon';
import {LanguageSwitcher} from '../../shared/language-switcher';

@Component({
  selector: 'app-admin', standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe, NzIconDirective, LanguageSwitcher],
  templateUrl: './admin.component.html', styleUrl: './admin.component.css'
})
export class AdminComponent {
  compact = window.innerWidth <= 900;
  isCollapsed = this.compact;
  @HostListener('window:resize') resize(): void {
    const compact = window.innerWidth <= 900;
    if (compact !== this.compact) { this.compact = compact; this.isCollapsed = compact; }
  }
  @HostListener('document:keydown.escape') escape(): void { this.closeOnMobile(); }
  closeOnMobile(): void { if (this.compact) this.isCollapsed = true; }
}
