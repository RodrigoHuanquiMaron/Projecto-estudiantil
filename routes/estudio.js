const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.nombre FROM inscripciones i JOIN cursos c ON c.id = i.curso_id
       WHERE i.usuario_id = $1 AND i.estado <> 'completado' ORDER BY c.nombre`,
      [req.session.user.id]);
    res.render('estudio', { title: 'Modo estudio', cursos: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
