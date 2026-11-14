import { Routes } from '@angular/router';
import {UserAuthGuardService} from '../services/guards/user-auth-guard.service';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/chat' },
  {
    path: 'library', canActivate: [UserAuthGuardService],
    loadComponent: () => import('../pages/library/library.component').then(m => m.LibraryComponent),
  },
  {
    path: 'chat',
    loadChildren: () =>
      import('../pages/chat.module').then(m => m.ChatModule),
  },
  {
    path: 'accounts',
    loadChildren: () =>
      import('../pages/accounts/account.module').then(m => m.AccountModule),
  },
  {
    path: 'admin',
    canActivate: [UserAuthGuardService],
    loadChildren: () =>
      import('../admin/admin.routes').then(m => m.ADMIN_ROUTES),
  },
  {
    path: 'image-studio',
    loadChildren: () =>
      import('../pages/imageStudio/image.module').then(m => m.ImageModule),
  },
  {
    path: 'media-studio',
    loadChildren: () =>
      import('../pages/multi-media-center/media.module').then(m => m.MediaModule),
  },
];
