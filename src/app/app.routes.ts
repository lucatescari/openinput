import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/deck',
    pathMatch: 'full',
  },
  {
    path: 'deck',
    loadComponent: () =>
      import('./pages/deck/deck.page').then((m) => m.DeckPage),
  },
  {
    path: 'profiles',
    loadComponent: () =>
      import('./pages/profiles/profiles.page').then((m) => m.ProfilesPage),
  },
  {
    path: 'store',
    loadComponent: () =>
      import('./pages/store/store.page').then((m) => m.StorePage),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings/settings.page').then((m) => m.SettingsPage),
  },
  {
    path: '**',
    redirectTo: '/deck',
  },
];
