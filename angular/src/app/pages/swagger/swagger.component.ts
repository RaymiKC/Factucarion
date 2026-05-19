import { Component, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../services/i18n.service';
import { environment } from '../../../environments/environment';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const SwaggerUIBundle: any;

@Component({
  selector: 'app-swagger',
  standalone: true,
  imports: [CommonModule],
  template: `<div id="swagger-ui" class="-m-6 min-h-screen"></div>`,
})
export class SwaggerComponent implements AfterViewInit {
  constructor(public i18n: I18nService) {}

  ngAfterViewInit() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js';
    script.onload = () => {
      SwaggerUIBundle({
        url: `${environment.supabaseUrl}/functions/v1/api/openapi`,
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: 'BaseLayout',
        requestInterceptor: (req: any) => {
          req.headers['Authorization'] = `Bearer ${environment.supabaseAnonKey}`;
          req.headers['apikey'] = environment.supabaseAnonKey;
          return req;
        },
      });
    };
    document.body.appendChild(script);
  }
}
