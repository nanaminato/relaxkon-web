import {RouterModule, Routes} from "@angular/router";
import {NgModule} from "@angular/core";

const routes: Routes = [
  {
    path: "",loadComponent: ()=> import("./top-image/top-image")
      .then(c=>c.TopImage),
    children: [
      {
        path: "",
        pathMatch:"full",
        redirectTo:"gpt-image",

      },
      {
        path: "gpt-image",
        loadComponent: ()=> import("./gpt-image/gpt-image-create.component")
          .then(c=>c.GptImageCreate)
      },
      {
        path: 'APIMart-image',
        loadComponent: () => import('./apimart-image/apimart-image.component').then(m => m.APIMartImage),
      },
      {
        path: "task-lib",
        loadComponent: ()=> import("./task-lib/task-lib")
          .then(c=>c.TaskLib)
      }
    ]
  }
];
@NgModule({
  imports: [
    RouterModule.forChild(routes),
  ],
  exports: [
    RouterModule
  ]
})
export class ImageRoutingModule{

}
