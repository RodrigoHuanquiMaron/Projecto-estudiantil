// WebSockets (Socket.IO): comunicación en tiempo real
const pool = require('../db/pool');
const { invalidate } = require('../utils/cache');
const { registrarActividad } = require('../services/actividades');

module.exports = function registrarSockets(io) {
  let conectados = 0;

  io.on('connection', (socket) => {
    // La sesión de Express llega aquí gracias a io.engine.use(sessionMiddleware)
    const user = socket.request.session && socket.request.session.user;
    if (!user) return socket.disconnect(true);

    socket.join(`user:${user.id}`); // "sala" privada para notificaciones del usuario
    conectados++;
    io.emit('online', conectados);

    // El cronómetro de la página de estudio guarda la sesión por aquí
    socket.on('estudio:guardar', async (payload = {}, ack) => {
      const responder = typeof ack === 'function' ? ack : () => {};
      try {
        const segundos = parseInt(payload.segundos, 10);
        if (!segundos || segundos < 10) {
          return responder({ ok: false, error: 'Estudia al menos 10 segundos antes de guardar.' });
        }
        const minutos = Math.max(1, Math.round(segundos / 60));

        let cursoId = parseInt(payload.cursoId, 10) || null;
        let nombreCurso = 'Estudio libre';
        if (cursoId) {
          const { rows } = await pool.query(
            `SELECT c.nombre FROM inscripciones i JOIN cursos c ON c.id = i.curso_id
             WHERE i.usuario_id = $1 AND i.curso_id = $2`,
            [user.id, cursoId]
          );
          if (rows[0]) nombreCurso = rows[0].nombre; else cursoId = null;
        }

        await pool.query(
          'INSERT INTO sesiones_estudio (usuario_id, curso_id, minutos) VALUES ($1,$2,$3)',
          [user.id, cursoId, minutos]
        );
        await invalidate(`panel:stats:${user.id}`, `desempeno:${user.id}`);
        await registrarActividad(io, user.id, 'estudio', `Sesión de estudio de ${minutos} min`, nombreCurso);

        responder({ ok: true, minutos });
      } catch (err) {
        console.error('estudio:guardar', err);
        responder({ ok: false, error: 'No se pudo guardar la sesión. Inténtalo de nuevo.' });
      }
    });

    socket.on('disconnect', () => {
      conectados = Math.max(0, conectados - 1);
      io.emit('online', conectados);
    });
  });
};
