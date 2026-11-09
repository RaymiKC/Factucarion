import 'dotenv/config';
import path from 'node:path';

export type DbProvider = 'postgres' | 'sqlserver';

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function parseProvider(raw: string | undefined): DbProvider {
  const value = (raw ?? 'postgres').trim().toLowerCase();
  if (value !== 'postgres' && value !== 'sqlserver') {
    throw new Error(`Unsupported DB_PROVIDER "${raw}". Use "postgres" or "sqlserver".`);
  }
  return value;
}

function buildPostgresConnectionString(): string {
  const host = process.env.PG_HOST ?? '127.0.0.1';
  const port = process.env.PG_PORT ?? '5432';
  const database = process.env.PG_DATABASE ?? 'facturpro';
  const user = encodeURIComponent(process.env.PG_USER ?? 'postgres');
  const password = encodeURIComponent(process.env.PG_PASSWORD ?? '');
  return `postgres://${user}:${password}@${host}:${port}/${database}`;
}

const port = Number(process.env.API_PORT ?? 3001);

export const config = {
  provider: parseProvider(process.env.DB_PROVIDER),
  port,
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  jwtSecret: process.env.JWT_SECRET ?? 'facturpro-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? path.join(__dirname, '..', 'uploads')),
  publicUrl: (process.env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/+$/, ''),
  otpDebug: bool(process.env.OTP_DEBUG, true),
  otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES ?? 10),
  maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS ?? 3),
  lockoutHours: Number(process.env.LOCKOUT_HOURS ?? 24),

  postgres: {
    connectionString: process.env.PG_CONNECTION_STRING?.trim() || buildPostgresConnectionString(),
    ssl: bool(process.env.PG_SSL, false),
  },

  sqlserver: {
    connectionString: process.env.MSSQL_CONNECTION_STRING?.trim() || '',
    server: process.env.MSSQL_SERVER ?? 'localhost',
    port: Number(process.env.MSSQL_PORT ?? 1433),
    database: process.env.MSSQL_DATABASE ?? 'FacturaPro',
    user: process.env.MSSQL_USER ?? '',
    password: process.env.MSSQL_PASSWORD ?? '',
    domain: process.env.MSSQL_DOMAIN || undefined,
    trustedConnection: bool(process.env.MSSQL_TRUSTED_CONNECTION, false),
    encrypt: bool(process.env.MSSQL_ENCRYPT, false),
    trustServerCertificate: bool(process.env.MSSQL_TRUST_CERT, true),
  },
};

export function describeConfig(): string {
  if (config.provider === 'postgres') {
    const url = config.postgres.connectionString.replace(/:\/\/([^:]+):[^@]*@/, '://$1:***@');
    return `postgres (${url})`;
  }
  const s = config.sqlserver;
  if (s.connectionString) return 'sqlserver (connection string)';
  return `sqlserver (${s.trustedConnection ? 'windows auth' : `${s.user || 'no-user'}@`}${s.server}:${s.port}/${s.database})`;
}
