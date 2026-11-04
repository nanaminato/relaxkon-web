import {Routes} from '@angular/router';
import {featureAdminGuard} from './guards/feature-admin.guard';
import {AdminComponent} from './pages/admin.component';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminComponent,
    canActivate: [featureAdminGuard],
    canActivateChild: [featureAdminGuard],
    children: [
      {path: 'feature-access', loadComponent: () => import('./pages/feature-access/feature-access.component').then(m => m.FeatureAccessComponent)},
      {path: '', pathMatch: 'full', redirectTo: 'accounts/account-info'},
      {
        path: 'accounts',
        loadChildren: () => import('./pages/accounts/account.module').then(m => m.AccountModule),
      },
      {
        path: 'secrets',
        loadChildren: () => import('./pages/secrets/secret.module').then(m => m.SecretModule),
      },
    ],
  },
];
