// Cliente de Redis: se usa para SESIONES y para CACHÉ
const { createClient } = require('redis');

let client = null;

async function connectRedis() {
  if (!process.env.REDIS_URL) {
    console.warn('⚠️  REDIS_URL vacío: sesiones en memoria y caché desactivada (solo para pruebas locales).');
    return null;
  }
  client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (err) => console.error('Redis:', err.message));
  await client.connect();
  console.log('✅ Redis conectado');
  return client;
}

const getRedis = () => client;

module.exports = { connectRedis, getRedis };
