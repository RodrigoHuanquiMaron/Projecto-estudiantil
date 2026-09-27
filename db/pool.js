// Conexión a PostgreSQL (un "pool" reutiliza conexiones para ser más rápido)
require('dotenv').config();
const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('❌ Falta DATABASE_URL en el archivo .env (revisa la GUIA.md, paso 4)');
  process.exit(1);
}

// Las URLs externas de Render (…render.com) exigen SSL. La interna y la local no.
let ssl = /render\.com/.test(url) ? { rejectUnauthorized: false } : false;
if (process.env.DB_SSL === 'true') ssl = { rejectUnauthorized: false };
if (process.env.DB_SSL === 'false') ssl = false;

const pool = new Pool({ connectionString: url, ssl });

module.exports = pool;
