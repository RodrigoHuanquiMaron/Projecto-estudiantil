const express = require('express');
const pool = require('../db/pool');
const { cached, invalidate } = require('../utils/cache');
const { iniciales, colorAvatar, soles, hace } = require('../utils/helpers');

const router = express.Router();

const obtenerStats = () => cached('donaciones:stats', 120, async () => {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(monto),0)::float AS total,
            COUNT(*)::int AS cantidad,
            COALESCE(AVG(monto),0)::float AS promedio,
            COUNT(DISTINCT nombre_donante)::int AS donantes
     FROM donaciones`);
  return rows[0];
});

const obtenerHonor = () => cached('donaciones:honor', 300, async () => {
  const { rows } = await pool.query(
    `SELECT nombre_donante AS nombre, SUM(monto)::float AS total
     FROM donaciones GROUP BY nombre_donante ORDER BY total DESC LIMIT 5`);
  return rows;
});

router.get('/', async (req, res, next) => {
  try {
    const [stats, honor, recientes] = await Promise.all([
      obtenerStats(),
      obtenerHonor(),
      pool.query('SELECT *, monto::float AS monto FROM donaciones ORDER BY creado_en DESC LIMIT 8'),
    ]);
    res.render('donaciones', { title: 'Donaciones', stats, honor, recientes: recientes.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const user = req.session.user;
    const monto = Math.round(Number(req.body.monto) * 100) / 100;
    const mensaje = (req.body.mensaje || '').trim().slice(0, 200) || null;
    const anonimo = req.body.anonimo === 'on';

    if (!monto || monto < 1 || monto > 10000) {
      req.flash('error', 'El monto debe estar entre S/1.00 y S/10,000.00.');
      return res.redirect('/donaciones');
    }

    const nombre = anonimo ? 'Estudiante Anónimo' : user.nombre;
    const { rows } = await pool.query(
      `INSERT INTO donaciones (usuario_id, nombre_donante, monto, mensaje, anonimo)
       VALUES ($1,$2,$3,$4,$5) RETURNING *, monto::float AS monto`,
      [user.id, nombre, monto, mensaje, anonimo]);

    // Los datos cambiaron: borramos la caché y avisamos a TODOS en tiempo real
    await invalidate('donaciones:stats', 'donaciones:honor');
    const [stats, honor] = await Promise.all([obtenerStats(), obtenerHonor()]);
    req.app.get('io').emit('donacion:nueva', {
      donacion: {
        nombre,
        iniciales: iniciales(nombre),
        color: colorAvatar(nombre),
        monto: soles(rows[0].monto),
        mensaje,
        cuando: hace(rows[0].creado_en),
      },
      stats: {
        total: soles(stats.total),
        cantidad: stats.cantidad,
        promedio: soles(stats.promedio),
        donantes: stats.donantes,
      },
      honor: honor.map(x => ({ nombre: x.nombre, total: soles(x.total) })),
    });

    req.flash('success', `Donación de ${soles(monto)} registrada. ¡Gracias!`);
    res.redirect('/donaciones');
  } catch (err) {
    next(err);
  }
});

router.get('/reporte.csv', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre_donante, monto, mensaje, creado_en FROM donaciones ORDER BY creado_en DESC');
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = ['id,donante,monto,mensaje,fecha']
      .concat(rows.map(r => [r.id, esc(r.nombre_donante), r.monto, esc(r.mensaje), r.creado_en.toISOString()].join(',')))
      .join('\n');
    res.attachment('donaciones.csv').type('text/csv').send('\uFEFF' + csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
