import {LanguageSwitcher} from '../../../shared/language-switcher';
import {Component} from '@angular/core';
import {RouterLink, RouterOutlet} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';

@Component({
  selector: 'app-account', standalone: true,
  imports: [RouterOutlet, RouterLink, TranslateModule, LanguageSwitcher],
  templateUrl: './account.html', styleUrl: './account.css'
})
export class Account {}
