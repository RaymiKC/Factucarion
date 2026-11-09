import { createApp } from './app';
import { config, describeConfig } from './config';
import { closeAdapter, getAdapter } from './db';

async function main(): Promise<void> {
  const db = await getAdapter();
  console.log(`[api] database ready: ${describeConfig()} (${db.tables.length} tables)`);

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[api] listening on http://localhost:${config.port}`);
    console.log(`[api] openapi  http://localhost:${config.port}/openapi.json`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n[api] ${signal} received, shutting down`);
    server.close();
    await closeAdapter();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch(error => {
  console.error('[api] failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
