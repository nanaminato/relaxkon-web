import {TranslatePipe} from '@ngx-translate/core';
import {RouterLink} from '@angular/router';
import { Component } from '@angular/core';

@Component({
  selector: 'app-error-page',
  templateUrl: './error-page.html',
  styleUrl: './error-page.css',
  imports: [TranslatePipe, RouterLink],
  standalone: true
})
export class ErrorPage {

}
