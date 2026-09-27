// Caché con Redis: si el dato está guardado lo devuelve al instante;
// si no, lo calcula en PostgreSQL y lo guarda por "ttl" segundos.
const { getRedis } = require('../config/redis');

async function cached(key, ttl, calcular) {
  const redis = getRedis();
  if (redis && redis.isReady) {
    const guardado = await redis.get(key);
    if (guardado) return JSON.parse(guardado);
  }
  const datos = await calcular();
  if (redis && redis.isReady) {
    await redis.set(key, JSON.stringify(datos), { EX: ttl });
  }
  return datos;
}

// Borra claves cuando los datos cambian (así nadie ve datos viejos)
async function invalidate(...keys) {
  const redis = getRedis();
  if (redis && redis.isReady && keys.length) await redis.del(keys);
}

module.exports = { cached, invalidate };
