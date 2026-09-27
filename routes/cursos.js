const express = require('express');
const pool = require('../db/pool');
const { invalidate } = require('../utils/cache');
const { registrarActividad } = require('../services/actividades');
const { ESTADOS } = require('../utils/helpers');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const uid = req.session.user.id;
    const filtro = Object.keys(ESTADOS).includes(req.query.estado) ? req.query.estado : null;
    const verTodos = req.query.todos === '1';

    const { rows } = await pool.query(
      `SELECT c.*, i.progreso, i.nota::float AS nota, i.estado
       FROM inscripciones i JOIN cursos c ON c.id = i.curso_id
       WHERE i.usuario_id = $1 AND ($2::text IS NULL OR i.estado = $2)
       ORDER BY c.id`, [uid, filtro]);

    const conteo = await pool.query(
      'SELECT estado, COUNT(*)::int AS n FROM inscripciones WHERE usuario_id = $1 GROUP BY estado', [uid]);
    const total = conteo.rows.reduce((a, r) => a + r.n, 0);

    res.render('cursos', {
      title: 'Mis cursos',
      cursos: verTodos ? rows : rows.slice(0, 6),
      hayMas: !verTodos && rows.length > 6,
      filtro,
      total,
      conteo: Object.fromEntries(conteo.rows.map(r => [r.estado, r.n])),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const uid = req.session.user.id;
    const { rows } = await pool.query(
      `SELECT c.*, i.progreso, i.nota::float AS nota, i.estado
       FROM inscripciones i JOIN cursos c ON c.id = i.curso_id
       WHERE i.usuario_id = $1 AND c.id = $2`, [uid, parseInt(req.params.id, 10) || 0]);
    if (!rows[0]) return next();

    const horas = await pool.query(
      `SELECT COALESCE(SUM(minutos),0)::int AS min, COUNT(*)::int AS sesiones
       FROM sesiones_estudio WHERE usuario_id = $1 AND curso_id = $2`, [uid, rows[0].id]);

    res.render('curso-detalle', { title: rows[0].nombre, curso: rows[0], estudio: horas.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Formulario "Registrar avance" → usa TempData (flash) para el mensaje
router.post('/:id/progreso', async (req, res, next) => {
  const cursoId = parseInt(req.params.id, 10) || 0;
  try {
    const uid = req.session.user.id;
    const progreso = parseInt(req.body.progreso, 10);
    const notaTxt = (req.body.nota || '').trim();
    const nota = notaTxt === '' ? null : Number(notaTxt);

    if (Number.isNaN(progreso) || progreso < 0 || progreso > 100) {
      req.flash('error', 'El progreso debe ser un número entre 0 y 100.');
      return res.redirect(`/cursos/${cursoId}`);
    }
    if (nota !== null && (Number.isNaN(nota) || nota < 0 || nota > 100)) {
      req.flash('error', 'La nota debe estar entre 0 y 100, o déjala vacía.');
      return res.redirect(`/cursos/${cursoId}`);
    }

    const estado = progreso === 0 ? 'no_iniciado' : progreso === 100 ? 'completado' : 'en_curso';
    const { rows } = await pool.query(
      `UPDATE inscripciones i SET progreso = $1, nota = $2, estado = $3
       FROM cursos c
       WHERE c.id = i.curso_id AND i.usuario_id = $4 AND i.curso_id = $5
       RETURNING c.nombre`, [progreso, nota, estado, uid, cursoId]);
    if (!rows[0]) return next();

    await invalidate(`panel:stats:${uid}`, `desempeno:${uid}`);
    await registrarActividad(req.app.get('io'), uid, 'progreso',
      `Avance actualizado a ${progreso}%`, rows[0].nombre);

    req.flash('success', `Avance de ${rows[0].nombre} guardado: ${progreso}%.`);
    res.redirect(`/cursos/${cursoId}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
