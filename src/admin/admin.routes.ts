import {Routes} from '@angular/router';
import {featureAdminGuard} from './guards/feature-admin.guard';
import {authSecurityGuard} from './guards/auth-security.guard';
import {AdminComponent} from './pages/admin.component';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminComponent,
    canActivate: [featureAdminGuard],
    canActivateChild: [featureAdminGuard],
    children: [
      {
        path: 'operations',
        children: [
          {path: '', pathMatch: 'full', redirectTo: 'models'},
          {
            matcher: segments => segments.length === 1 &&
              ['models', 'trend', 'users', 'diagnostics'].includes(segments[0].path)
              ? {consumed: segments, posParams: {view: segments[0]}} : null,
            loadComponent: () => import('./pages/operations/operations.component').then(m => m.OperationsComponent)
          }
        ]
      },
      {path: 'auth-security', canActivate: [authSecurityGuard], loadComponent: () => import('./pages/auth-security/auth-security.component').then(m => m.AuthSecurityComponent)},
      {path: 'library', loadComponent: () => import('./pages/library-limits.component').then(m => m.LibraryLimitsComponent)},
      {path: 'feature-access', loadComponent: () => import('./pages/feature-access/feature-access.component').then(m => m.FeatureAccessComponent)},
      {path: '', pathMatch: 'full', redirectTo: 'operations/models'},
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
