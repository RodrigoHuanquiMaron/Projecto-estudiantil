const express = require('express');
const pool = require('../db/pool');
const { cached } = require('../utils/cache');

const router = express.Router();
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

router.get('/', async (req, res, next) => {
  try {
    const uid = req.session.user.id;

    // Tarjetas de arriba: se guardan 2 minutos en Redis
    const stats = await cached(`panel:stats:${uid}`, 120, async () => {
      const ins = await pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE estado = 'en_curso')::int AS en_curso,
                COUNT(*) FILTER (WHERE estado = 'completado')::int AS completados,
                ROUND(AVG(nota), 1)::float AS promedio,
                MAX(nota)::float AS maxima
         FROM inscripciones WHERE usuario_id = $1`, [uid]);
      const horas = await pool.query(
        `SELECT COALESCE(SUM(minutos), 0)::int AS total,
                COALESCE(SUM(minutos) FILTER (WHERE fecha > CURRENT_DATE - 28), 0)::int AS ultimas4
         FROM sesiones_estudio WHERE usuario_id = $1`, [uid]);
      const cert = await pool.query('SELECT COUNT(*)::int AS n FROM certificados WHERE usuario_id = $1', [uid]);
      return {
        ...ins.rows[0],
        horas: Math.round((horas.rows[0].total / 60) * 10) / 10,
        horasSemana: Math.round((horas.rows[0].ultimas4 / 60 / 4) * 10) / 10,
        certificados: cert.rows[0].n,
      };
    });

    const cursos = await pool.query(
      `SELECT c.id, c.nombre, c.categoria, c.instructor, i.progreso, i.nota::float AS nota, i.estado
       FROM inscripciones i JOIN cursos c ON c.id = i.curso_id
       WHERE i.usuario_id = $1
       ORDER BY CASE i.estado WHEN 'en_curso' THEN 0 WHEN 'completado' THEN 1 ELSE 2 END, c.id
       LIMIT 4`, [uid]);

    const semanaRows = await pool.query(
      `SELECT EXTRACT(ISODOW FROM fecha)::int AS dia, SUM(minutos)::int AS minutos
       FROM sesiones_estudio
       WHERE usuario_id = $1 AND fecha >= date_trunc('week', CURRENT_DATE)::date
       GROUP BY dia`, [uid]);
    const semana = DIAS.map((nombre, i) => {
      const fila = semanaRows.rows.find(r => r.dia === i + 1);
      return { nombre, minutos: fila ? fila.minutos : 0 };
    });
    const hoy = ((new Date().getDay() + 6) % 7); // 0 = lunes

    const actividades = await pool.query(
      'SELECT * FROM actividades WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT 5', [uid]);

    res.render('panel', {
      title: 'Panel',
      stats,
      cursos: cursos.rows,
      semana,
      hoy,
      totalSemana: Math.round(semana.reduce((a, d) => a + d.minutos, 0) / 6) / 10,
      actividades: actividades.rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
