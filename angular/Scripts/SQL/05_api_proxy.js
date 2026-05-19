/**
 * FacturaPro - SQL Server API Proxy
 * =====================================
 * A lightweight Express server that exposes a REST API the frontend
 * uses when VITE_DB_PROVIDER=sqlserver.
 *
 * Run:
 *   node Scripts/SQL/05_api_proxy.js
 *
 * Environment variables (.env or shell):
 *   MSSQL_SERVER=localhost
 *   MSSQL_PORT=1433
 *   MSSQL_DATABASE=FacturaPro
 *   MSSQL_USER=sa
 *   MSSQL_PASSWORD=YourPassword
 *   MSSQL_TRUST_CERT=true         (for local dev / self-signed certs)
 *   PROXY_PORT=3001               (default: 3001)
 *   PROXY_CORS_ORIGIN=*           (default: *)
 *
 * Install dependencies (from project root):
 *   npm install mssql express cors dotenv
 *
 * NOTE: This proxy should run in a trusted network or behind auth
 *       middleware before exposing to production traffic.
 */

require('dotenv').config({ path: '../../.env' });

const express = require('express');
const cors    = require('cors');
const sql     = require('mssql');

const PORT        = process.env.PROXY_PORT ?? 3001;
const CORS_ORIGIN = process.env.PROXY_CORS_ORIGIN ?? '*';

const sqlConfig = {
  server:   process.env.MSSQL_SERVER   ?? 'localhost',
  port:     parseInt(process.env.MSSQL_PORT ?? '1433'),
  database: process.env.MSSQL_DATABASE ?? 'FacturaPro',
  user:     process.env.MSSQL_USER,
  password: process.env.MSSQL_PASSWORD,
  options: {
    trustServerCertificate: process.env.MSSQL_TRUST_CERT !== 'false',
    enableArithAbort: true,
  },
};

if (!sqlConfig.user || !sqlConfig.password) {
  console.error('[proxy] MSSQL_USER and MSSQL_PASSWORD must be set. Exiting.');
  process.exit(1);
}

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

let pool;

async function getPool() {
  if (!pool) pool = await sql.connect(sqlConfig);
  return pool;
}

// Health check
app.get('/health', async (_req, res) => {
  try {
    const p = await getPool();
    await p.request().query('SELECT 1 AS ok');
    res.json({ ok: true, provider: 'sqlserver' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Generic SELECT
app.post('/query', async (req, res) => {
  const { table, select = '*', filters = {}, order, limit, offset } = req.body;

  if (!isValidIdentifier(table)) return res.status(400).json({ error: 'Invalid table name' });

  const p       = await getPool();
  const request = p.request();

  const conditions = [];
  let   paramIdx   = 0;

  for (const [col, val] of Object.entries(filters)) {
    if (!isValidIdentifier(col)) return res.status(400).json({ error: `Invalid column: ${col}` });
    const pname = `p${paramIdx++}`;
    conditions.push(`[${col}] = @${pname}`);
    request.input(pname, val);
  }

  let sql_ = `SELECT ${sanitizeSelect(select)} FROM [${table}]`;
  if (conditions.length) sql_ += ` WHERE ${conditions.join(' AND ')}`;
  if (order)  sql_ += ` ORDER BY ${sanitizeOrder(order)}`;
  if (limit)  sql_ += ` OFFSET ${parseInt(offset ?? 0)} ROWS FETCH NEXT ${parseInt(limit)} ROWS ONLY`;

  try {
    const result = await request.query(sql_);
    res.json({ data: result.recordset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generic INSERT / UPDATE / DELETE
app.post('/mutate', async (req, res) => {
  const { operation, table, data = {}, filters = {} } = req.body;

  if (!isValidIdentifier(table)) return res.status(400).json({ error: 'Invalid table name' });

  const p       = await getPool();
  const request = p.request();
  let   sql_; let paramIdx = 0;

  function addParam(val) {
    const n = `p${paramIdx++}`; request.input(n, val); return `@${n}`;
  }

  if (operation === 'insert') {
    const cols = Object.keys(data).filter(isValidIdentifier);
    const vals = cols.map(c => addParam(data[c]));
    sql_ = `INSERT INTO [${table}] (${cols.map(c => `[${c}]`).join(',')}) OUTPUT INSERTED.* VALUES (${vals.join(',')})`;
  } else if (operation === 'update') {
    const setCols  = Object.keys(data).filter(isValidIdentifier);
    const setParts = setCols.map(c => `[${c}] = ${addParam(data[c])}`);
    const conds    = Object.keys(filters).filter(isValidIdentifier).map(c => `[${c}] = ${addParam(filters[c])}`);
    if (!conds.length) return res.status(400).json({ error: 'Update requires at least one filter' });
    sql_ = `UPDATE [${table}] SET ${setParts.join(',')} OUTPUT INSERTED.* WHERE ${conds.join(' AND ')}`;
  } else if (operation === 'delete') {
    const conds = Object.keys(filters).filter(isValidIdentifier).map(c => `[${c}] = ${addParam(filters[c])}`);
    if (!conds.length) return res.status(400).json({ error: 'Delete requires at least one filter' });
    sql_ = `DELETE FROM [${table}] WHERE ${conds.join(' AND ')}`;
  } else {
    return res.status(400).json({ error: 'Invalid operation' });
  }

  try {
    const result = await request.query(sql_);
    res.json({ data: result.recordset ?? [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[FacturaPro SQL Server Proxy] Listening on http://localhost:${PORT}`);
});

function isValidIdentifier(s) {
  return typeof s === 'string' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s);
}

function sanitizeSelect(s) {
  if (s === '*') return '*';
  return s.split(',').map(p => p.trim()).filter(isValidIdentifier).map(p => `[${p}]`).join(', ') || '*';
}

function sanitizeOrder(s) {
  return s.split(',').map(p => {
    const [col, dir = 'ASC'] = p.trim().split(/\s+/);
    if (!isValidIdentifier(col)) return null;
    const safeDir = dir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    return `[${col}] ${safeDir}`;
  }).filter(Boolean).join(', ');
}
