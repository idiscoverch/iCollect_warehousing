import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path:'',
    redirectTo: '/tabs/home',
    pathMatch: 'full'
  },
  {
    path: '',
    component: TabsPage,
    children: 
    [ 
      { 
        path: 'home', 
        children: [
          {
            path: '',
            loadChildren: () => 
            import('../home/home.module').then( m => m.HomePageModule)
          }
        ]
      },
      { 
        path: 'settings', 
        children: [
          {
            path: '',
            loadChildren: () => 
            import('../settings/settings.module').then( m => m.SettingsPageModule)
          }
        ]
      },
      {
        path: 'loading',
        children: [
          {
            path: '',
            loadChildren: () => 
            import('../loading/loading.module').then( m => m.LoadingPageModule)
          }
        ]
      }
    ]
  }
];


@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabsPageRoutingModule {}
