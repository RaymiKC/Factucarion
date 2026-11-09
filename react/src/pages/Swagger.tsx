import { useEffect, useRef } from 'react';
import { API_BASE, getAuthToken } from '../lib/db';

const SPEC_URL = `${API_BASE}/openapi.json`;

export default function Swagger() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;

    // Load Swagger UI from CDN
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css';
    document.head.appendChild(cssLink);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js';
    script.onload = () => {
      const win = window as unknown as Record<string, unknown>;
      const SwaggerUIBundle = win['SwaggerUIBundle'] as (opts: Record<string, unknown>) => void;
      if (!SwaggerUIBundle || !containerRef.current) return;

      SwaggerUIBundle({
        url: SPEC_URL,
        domNode: containerRef.current,
        presets: [
          (win['SwaggerUIBundle'] as { presets: { apis: unknown; SwaggerUIStandalonePreset: unknown } } & ((opts: Record<string, unknown>) => void)).presets.apis,
        ],
        layout: 'BaseLayout',
        deepLinking: true,
        requestInterceptor: (request: { headers: Record<string, string> }) => {
          const token = getAuthToken();
          if (token) request.headers['Authorization'] = `Bearer ${token}`;
          return request;
        },
        onComplete: () => {
          // Style overrides applied via CSS below
        },
      });
    };
    document.head.appendChild(script);

    return () => {
      // cleanup not strictly needed since layout unmounts rarely
    };
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">API Documentation</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Interactive REST API explorer — requests carry your current session token automatically.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400 dark:text-slate-500 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 max-w-sm truncate">
              {API_BASE}
            </div>
            <a
              href={SPEC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors font-medium"
            >
              Raw JSON
            </a>
          </div>
        </div>
      </div>

      {/* Swagger UI mount point */}
      <div ref={containerRef} id="swagger-ui" className="swagger-wrapper" />

      {/* Style overrides to blend with the app theme */}
      <style>{`
        .swagger-wrapper .swagger-ui .topbar { display: none !important; }
        .swagger-wrapper .swagger-ui .info { margin: 24px 0 16px; }
        .swagger-wrapper .swagger-ui .info .title { font-size: 22px; }
        .swagger-wrapper .swagger-ui .scheme-container { padding: 12px 20px; background: transparent; box-shadow: none; border-bottom: 1px solid #e2e8f0; }
        .swagger-wrapper .swagger-ui .opblock-tag { font-size: 15px; font-weight: 600; }
        .swagger-wrapper .swagger-ui .btn.authorize { background: #0284c7; color: #fff; border-color: #0284c7; }
        .swagger-wrapper .swagger-ui .btn.authorize:hover { background: #0369a1; }
        .swagger-wrapper .swagger-ui .opblock.opblock-get .opblock-summary { border-color: #93c5fd; }
        .swagger-wrapper .swagger-ui .opblock.opblock-get { background: #eff6ff; border-color: #93c5fd; }
        .swagger-wrapper .swagger-ui .opblock.opblock-post { background: #f0fdf4; border-color: #86efac; }
        .swagger-wrapper .swagger-ui .opblock.opblock-put { background: #fffbeb; border-color: #fcd34d; }
        .swagger-wrapper .swagger-ui .opblock.opblock-delete { background: #fff1f2; border-color: #fda4af; }
        .swagger-wrapper .swagger-ui table thead tr td,
        .swagger-wrapper .swagger-ui table thead tr th { border-bottom: 1px solid #e2e8f0; padding: 8px 12px; }
        .swagger-wrapper .swagger-ui .wrapper { padding: 0 20px; }
        @media (prefers-color-scheme: dark) {
          .swagger-wrapper .swagger-ui { filter: invert(0.88) hue-rotate(180deg); }
          .swagger-wrapper .swagger-ui img { filter: invert(1) hue-rotate(180deg); }
        }
        .dark .swagger-wrapper .swagger-ui { filter: invert(0.88) hue-rotate(180deg); }
        .dark .swagger-wrapper .swagger-ui img { filter: invert(1) hue-rotate(180deg); }
      `}</style>
    </div>
  );
}
