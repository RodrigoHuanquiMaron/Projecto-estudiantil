const express = require('express');
const pool = require('../db/pool');
const { cached } = require('../utils/cache');

const router = express.Router();
const CREDITOS_CARRERA = 120;
const HORAS_RECOMENDADAS = 28;

const r1 = (n) => Math.round(n * 10) / 10;

async function calcularDesempeno(uid) {
  const usuario = (await pool.query('SELECT creditos_previos FROM usuarios WHERE id = $1', [uid])).rows[0];

  const cursos = (await pool.query(
    `SELECT c.nombre, c.categoria, c.creditos, i.progreso, i.nota::float AS nota, i.estado
     FROM inscripciones i JOIN cursos c ON c.id = i.curso_id
     WHERE i.usuario_id = $1
     ORDER BY i.nota DESC NULLS LAST, c.nombre`, [uid])).rows;

  const conNota = cursos.filter(c => c.nota !== null);
  const promedio = conNota.length ? r1(conNota.reduce((a, c) => a + c.nota, 0) / conNota.length) : null;

  const creditosAprobados = usuario.creditos_previos +
    cursos.filter(c => c.estado === 'completado').reduce((a, c) => a + c.creditos, 0);

  // Ranking entre todos los estudiantes (consulta pesada → por eso va en caché)
  const rk = (await pool.query(
    `WITH prom AS (
       SELECT usuario_id, AVG(nota) AS p FROM inscripciones
       WHERE nota IS NOT NULL GROUP BY usuario_id
     ), pos AS (
       SELECT usuario_id, RANK() OVER (ORDER BY p DESC) AS puesto, COUNT(*) OVER () AS total FROM prom
     )
     SELECT puesto::int, total::int FROM pos WHERE usuario_id = $1`, [uid])).rows[0];
  const ranking = rk ? { ...rk, top: Math.ceil((rk.puesto / rk.total) * 100) } : null;

  const ciclos = (await pool.query(
    'SELECT ciclo, promedio::float AS promedio FROM notas_ciclo WHERE usuario_id = $1 ORDER BY orden', [uid])).rows;
  const anterior = ciclos.length ? ciclos[ciclos.length - 1].promedio : null;
  const tendencia = promedio !== null && anterior !== null ? r1(promedio - anterior) : null;
  if (promedio !== null) ciclos.push({ ciclo: 'Actual', promedio });

  // Puntos del gráfico de línea (SVG 600 x 200, escala de 70 a 100)
  const W = 600, H = 200, MIN = 70, MAX = 100;
  const puntos = ciclos.map((c, i) => ({
    ...c,
    x: ciclos.length > 1 ? 30 + (i * (W - 60)) / (ciclos.length - 1) : W / 2,
    y: H - 25 - ((Math.max(MIN, c.promedio) - MIN) / (MAX - MIN)) * (H - 50),
  }));

  const semana = (await pool.query(
    `SELECT COALESCE(SUM(minutos),0)::int AS min, COUNT(*)::int AS sesiones,
            COUNT(DISTINCT curso_id)::int AS cursos
     FROM sesiones_estudio WHERE usuario_id = $1 AND fecha > CURRENT_DATE - 7`, [uid])).rows[0];

  const metas = (await pool.query('SELECT * FROM metas WHERE usuario_id = $1 ORDER BY id', [uid])).rows;

  const distribucion = {
    a: conNota.filter(c => c.nota >= 90).length,
    b: conNota.filter(c => c.nota < 90).length,
    pendientes: cursos.length - conNota.length,
  };

  return {
    cursos,
    promedio,
    creditosAprobados,
    creditosCarrera: CREDITOS_CARRERA,
    ranking,
    tendencia,
    puntos,
    horasSemana: r1(semana.min / 60),
    horasRecomendadas: HORAS_RECOMENDADAS,
    sesionesSemana: semana.sesiones,
    cursosSemana: semana.cursos,
    prioritarios: cursos.filter(c => c.estado !== 'completado')
      .sort((a, b) => (a.nota ?? -1) - (b.nota ?? -1)).slice(0, 3),
    proyeccion: promedio !== null ? Math.min(100, r1(promedio + (100 - promedio) * 0.15)) : null,
    fortalezas: conNota.filter(c => c.nota >= 91),
    mejoras: cursos.filter(c => c.nota === null || c.nota < 90),
    distribucion,
    metas,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const uid = req.session.user.id;
    const datos = await cached(`desempeno:${uid}`, 300, () => calcularDesempeno(uid));
    res.render('desempeno', { title: 'Desempeño académico', d: datos });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
