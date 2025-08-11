const { Pool } = require('pg');

// Validate and normalize environment variables early to provide clear errors
const getEnv = (key) => process.env[key];

const sslRaw = getEnv('DB_SSL');
const isSSL = String(sslRaw).toLowerCase() === 'true';

const required = {
  DB_HOST: getEnv('DB_HOST'),
  DB_USER: getEnv('DB_USER'),
  DB_PASSWORD: getEnv('DB_PASSWORD'),
  DB_NAME: getEnv('DB_NAME'),
};

const missing = Object.entries(required).filter(([k, v]) => typeof v !== 'string' || v.trim() === '');
if (missing.length) {
  const keys = missing.map(([k]) => k).join(', ');
  throw new Error(`Database config error: Missing or invalid env vars: ${keys}. Check server/.env (see server/.env.example).`);
}

const portRaw = getEnv('DB_PORT');
const port = portRaw ? Number(portRaw) : 5432;
if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`Database config error: DB_PORT must be a positive integer. Received: ${portRaw}`);
}

const pool = new Pool({
  host: required.DB_HOST,
  port,
  user: required.DB_USER,
  password: String(required.DB_PASSWORD), // enforce string to avoid pg SCRAM error
  database: required.DB_NAME,
  ssl: isSSL ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
