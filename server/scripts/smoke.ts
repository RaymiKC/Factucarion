/*
  End-to-end smoke test for the FacturaPro API.

  Usage (with the API already running):
    npm run smoke
    npm run smoke -- --base http://localhost:3001 --email admin@miempresa.com --password Admin123!

  It exercises: health, login, token auth, insert, select, update and delete.
*/

interface Args {
  base: string;
  email: string;
  password: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    base: process.env.API_BASE ?? 'http://localhost:3001',
    email: process.env.SMOKE_EMAIL ?? 'admin@miempresa.com',
    password: process.env.SMOKE_PASSWORD ?? 'Admin123!',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!value) continue;
    if (flag === '--base') args.base = value;
    if (flag === '--email') args.email = value;
    if (flag === '--password') args.password = value;
  }

  return { ...args, base: args.base.replace(/\/+$/, '') };
}

async function call<T = any>(
  base: string,
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${options.method ?? 'POST'} ${path} -> ${response.status}: ${payload?.error ?? text}`);
  }
  return payload as T;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const results: string[] = [];

  const health = await call<any>(args.base, '/health', { method: 'GET' });
  results.push(`health: ${health.ok ? 'ok' : 'FAILED'} (${health.database?.provider}, ${health.database?.tables} tables)`);

  const login = await call<any>(args.base, '/api/auth/login', {
    body: { email: args.email, password: args.password },
  });
  if (login.status !== 'authenticated' || !login.token) {
    throw new Error(`login did not return a session (status: ${login.status})`);
  }
  results.push(`login: ok as ${login.user.email} (${login.user.role})`);

  const token = login.token as string;
  const companyId = login.user.assignedCompanyIds?.[0];
  if (!companyId) throw new Error('admin user has no company assigned');

  const created = await call<any>(args.base, '/api/db/clients/insert', {
    token,
    body: {
      rows: [{ company_id: companyId, name: '__smoke test__', email: 'smoke@example.com', client_type: 'person' }],
    },
  });
  const client = created.data[0];
  results.push(`insert: ok (${client.id})`);

  const selected = await call<any>(args.base, '/api/db/clients/select', {
    token,
    body: {
      filters: [
        { column: 'company_id', op: 'eq', value: companyId },
        { column: 'id', op: 'eq', value: client.id },
      ],
      limit: 1,
    },
  });
  if (!selected.data?.length) throw new Error('select did not return the inserted row');
  results.push('select: ok');

  const updated = await call<any>(args.base, '/api/db/clients/update', {
    token,
    body: { values: { city: 'Smoke City' }, filters: [{ column: 'id', op: 'eq', value: client.id }] },
  });
  if (updated.data?.[0]?.city !== 'Smoke City') throw new Error('update did not persist');
  results.push('update: ok');

  await call<any>(args.base, '/api/db/clients/delete', {
    token,
    body: { filters: [{ column: 'id', op: 'eq', value: client.id }] },
  });
  results.push('delete: ok');

  const reloaded = await call<any>(args.base, '/api/db/clients/select', {
    token,
    body: { filters: [{ column: 'id', op: 'eq', value: client.id }] },
  });
  if (reloaded.data?.length) throw new Error('delete did not remove the row');
  results.push('delete verified: ok');

  console.log('\nSmoke test passed\n');
  for (const line of results) console.log(`  ✓ ${line}`);
  console.log();
}

main().catch(error => {
  console.error(`\nSmoke test failed: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
