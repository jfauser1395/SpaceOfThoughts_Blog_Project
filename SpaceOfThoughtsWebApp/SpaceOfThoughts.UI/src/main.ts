import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Bootstrap with Angular 22's default zoneless change detection
bootstrapApplication(AppComponent, appConfig).catch((error) =>
  console.error(error),
);
