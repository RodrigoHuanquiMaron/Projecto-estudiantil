const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { guestOnly } = require('../middleware/auth');
const { iniciales } = require('../utils/helpers');

const router = express.Router();
const TREINTA_DIAS = 1000 * 60 * 60 * 24 * 30;

router.get('/', (req, res) => res.redirect(req.session.user ? '/panel' : '/login'));

router.get('/login', guestOnly, (req, res) => {
  // COOKIE propia: recuerda el último correo si marcó "Recordarme"
  res.render('login', { title: 'Iniciar sesión', emailRecordado: req.cookies.recordar_email || '' });
});

router.post('/login', guestOnly, async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';
    const recordarme = req.body.recordarme === 'on';

    if (!email || !password) {
      req.flash('error', 'Escribe tu correo y tu contraseña.');
      return res.redirect('/login');
    }

    const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const usuario = rows[0];
    const valido = usuario && (await bcrypt.compare(password, usuario.password_hash));
    if (!valido) {
      req.flash('error', 'Correo o contraseña incorrectos.');
      return res.redirect('/login');
    }

    // Nueva sesión (evita robo de sesión / session fixation)
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        carrera: usuario.carrera,
        ciclo: usuario.ciclo,
        iniciales: iniciales(usuario.nombre),
      };
      if (recordarme) {
        req.session.cookie.maxAge = TREINTA_DIAS;
        res.cookie('recordar_email', email, { maxAge: TREINTA_DIAS, httpOnly: true, sameSite: 'lax' });
      } else {
        res.clearCookie('recordar_email');
      }
      req.flash('success', `¡Hola de nuevo, ${usuario.nombre.split(' ')[0]}!`);
      req.session.save(() => res.redirect('/panel'));
    });
  } catch (err) {
    next(err);
  }
});

router.get('/registro', guestOnly, (req, res) => res.render('registro', { title: 'Crear cuenta' }));

router.post('/registro', guestOnly, async (req, res, next) => {
  const nombre = (req.body.nombre || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (nombre.length < 3 || !email.includes('@') || password.length < 6) {
    req.flash('error', 'Revisa los datos: nombre de 3+ letras, correo válido y contraseña de 6+ caracteres.');
    return res.redirect('/registro');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await client.query(
      'INSERT INTO usuarios (nombre, email, password_hash) VALUES ($1,$2,$3) RETURNING id',
      [nombre, email, hash]
    );
    const id = rows[0].id;
    await client.query('INSERT INTO inscripciones (usuario_id, curso_id) SELECT $1, id FROM cursos', [id]);
    await client.query(
      `INSERT INTO metas (usuario_id, titulo, detalle, progreso) VALUES
        ($1, 'Mantener promedio superior al 90%', 'Aún sin notas', 0),
        ($1, 'Estudiar 10 horas esta semana', '0 de 10 horas', 0)`,
      [id]
    );
    await client.query(
      `INSERT INTO actividades (usuario_id, tipo, descripcion, detalle)
       VALUES ($1, 'bienvenida', 'Te uniste a MasterEstudio', 'Cuenta creada')`,
      [id]
    );
    await client.query('COMMIT');
    req.flash('success', 'Cuenta creada. Ya puedes iniciar sesión.');
    res.redirect('/login');
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      req.flash('error', 'Ese correo ya está registrado. Inicia sesión.');
      return res.redirect('/registro');
    }
    next(err);
  } finally {
    client.release();
  }
});

router.get('/auth/google', (req, res) => {
  req.flash('error', 'El ingreso con Google aún no está activado. Usa tu correo y contraseña.');
  res.redirect('/login');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('masterestudio.sid');
    res.redirect('/login');
  });
});

module.exports = router;
