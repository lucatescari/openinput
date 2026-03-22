import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

try {
  await bootstrapApplication(AppComponent, {
    providers: [
      provideRouter(routes),
      provideHttpClient(),
      provideAnimations(),
      provideExperimentalZonelessChangeDetection(),
    ],
  });
} catch (err) {
  console.error(err);
}
