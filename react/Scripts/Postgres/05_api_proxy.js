/**
 * FacturaPro - PostgreSQL API Proxy
 * ===================================
 * A lightweight Express server that exposes a REST API the frontend
 * uses when VITE_DB_PROVIDER=postgres.
 *
 * Run:
 *   node Scripts/Postgres/05_api_proxy.js
 *
 * Environment variables (.env or shell):
 *   PG_CONNECTION_STRING=postgresql://user:pass@host:5432/facturapro
 *   PROXY_PORT=3001              (default: 3001)
 *   PROXY_CORS_ORIGIN=*          (default: *)
 *
 * Install dependencies (from project root):
 *   npm install pg express cors dotenv
 *
 * NOTE: This proxy should run in a trusted network or behind auth
 *       middleware before exposing to production traffic.
 */

require('dotenv').config({ path: '../../.env' });

const express    = require('express');
const cors       = require('cors');
const { Pool }   = require('pg');

const PORT        = process.env.PROXY_PORT ?? 3001;
const CORS_ORIGIN = process.env.PROXY_CORS_ORIGIN ?? '*';
const PG_CONN     = process.env.PG_CONNECTION_STRING;

if (!PG_CONN) {
  console.error('[proxy] PG_CONNECTION_STRING is not set. Exiting.');
  process.exit(1);
}

const pool = new Pool({ connectionString: PG_CONN });

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Health check
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, provider: 'postgres' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Generic SELECT
app.post('/query', async (req, res) => {
  const { table, select = '*', filters = {}, order, limit, offset } = req.body;

  if (!isValidIdentifier(table)) return res.status(400).json({ error: 'Invalid table name' });

  const conditions = [];
  const values     = [];
  let   paramIdx   = 1;

  for (const [col, val] of Object.entries(filters)) {
    if (!isValidIdentifier(col)) return res.status(400).json({ error: `Invalid column: ${col}` });
    conditions.push(`"${col}" = $${paramIdx++}`);
    values.push(val);
  }

  let sql = `SELECT ${sanitizeSelect(select)} FROM "${table}"`;
  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
  if (order)  sql += ` ORDER BY ${sanitizeOrder(order)}`;
  if (limit)  sql += ` LIMIT ${parseInt(limit)}`;
  if (offset) sql += ` OFFSET ${parseInt(offset)}`;

  try {
    const result = await pool.query(sql, values);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generic INSERT / UPDATE / DELETE
app.post('/mutate', async (req, res) => {
  const { operation, table, data = {}, filters = {} } = req.body;

  if (!isValidIdentifier(table)) return res.status(400).json({ error: 'Invalid table name' });

  let sql; const values = []; let paramIdx = 1;

  if (operation === 'insert') {
    const cols = Object.keys(data).filter(isValidIdentifier);
    const vals = cols.map(c => { values.push(data[c]); return `$${paramIdx++}`; });
    sql = `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${vals.join(',')}) RETURNING *`;
  } else if (operation === 'update') {
    const setCols = Object.keys(data).filter(isValidIdentifier);
    const setParts = setCols.map(c => { values.push(data[c]); return `"${c}" = $${paramIdx++}`; });
    const conds = Object.keys(filters).filter(isValidIdentifier).map(c => { values.push(filters[c]); return `"${c}" = $${paramIdx++}`; });
    if (!conds.length) return res.status(400).json({ error: 'Update requires at least one filter' });
    sql = `UPDATE "${table}" SET ${setParts.join(',')} WHERE ${conds.join(' AND ')} RETURNING *`;
  } else if (operation === 'delete') {
    const conds = Object.keys(filters).filter(isValidIdentifier).map(c => { values.push(filters[c]); return `"${c}" = $${paramIdx++}`; });
    if (!conds.length) return res.status(400).json({ error: 'Delete requires at least one filter' });
    sql = `DELETE FROM "${table}" WHERE ${conds.join(' AND ')}`;
  } else {
    return res.status(400).json({ error: 'Invalid operation' });
  }

  try {
    const result = await pool.query(sql, values);
    res.json({ data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[FacturaPro Postgres Proxy] Listening on http://localhost:${PORT}`);
});

// ------------------------------------------------------------------
// Helpers – basic allowlist validation to prevent SQL injection
// ------------------------------------------------------------------
function isValidIdentifier(s) {
  return typeof s === 'string' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s);
}

function sanitizeSelect(s) {
  if (s === '*') return '*';
  return s.split(',').map(p => p.trim()).filter(isValidIdentifier).map(p => `"${p}"`).join(', ') || '*';
}

function sanitizeOrder(s) {
  return s.split(',').map(p => {
    const [col, dir = 'ASC'] = p.trim().split(/\s+/);
    if (!isValidIdentifier(col)) return null;
    const safeDir = dir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    return `"${col}" ${safeDir}`;
  }).filter(Boolean).join(', ');
}
