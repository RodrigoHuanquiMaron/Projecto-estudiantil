// Registra una actividad y la envía EN VIVO al usuario por WebSocket
const pool = require('../db/pool');
const { hace } = require('../utils/helpers');

async function registrarActividad(io, usuarioId, tipo, descripcion, detalle = null) {
  const { rows } = await pool.query(
    `INSERT INTO actividades (usuario_id, tipo, descripcion, detalle)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [usuarioId, tipo, descripcion, detalle]
  );
  const act = rows[0];
  if (io) {
    io.to(`user:${usuarioId}`).emit('actividad:nueva', {
      tipo: act.tipo,
      descripcion: act.descripcion,
      detalle: act.detalle,
      cuando: hace(act.creado_en),
    });
  }
  return act;
}

module.exports = { registrarActividad };
