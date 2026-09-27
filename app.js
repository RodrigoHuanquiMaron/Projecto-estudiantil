// ===============================================
//  MasterEstudio · Servidor principal (Node.js)
// ===============================================
require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
const { Server } = require('socket.io');

const { connectRedis } = require('./config/redis');
const { ensureDatabase } = require('./db/setup');
const { requireAuth } = require('./middleware/auth');
const helpers = require('./utils/helpers');

async function start() {
  const redisClient = await connectRedis();
  await ensureDatabase();

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  app.set('io', io); // las rutas lo usan con req.app.get('io')

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.set('trust proxy', 1); // Render usa un proxy HTTPS delante de la app
  app.locals.h = helpers;

  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(cookieParser());

  // ---- SESIONES guardadas en Redis + COOKIE de sesión ----
  const sessionMiddleware = session({
    store: redisClient ? new RedisStore({ client: redisClient, prefix: 'sess:' }) : undefined,
    secret: process.env.SESSION_SECRET || 'solo-para-desarrollo',
    name: 'masterestudio.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,                                  // JS del navegador no puede leerla
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',   // solo HTTPS en Render
      maxAge: 1000 * 60 * 60 * 2,                      // 2 horas (30 días con "Recordarme")
    },
  });
  app.use(sessionMiddleware);
  io.engine.use(sessionMiddleware); // comparte la sesión con los WebSockets

  // ---- TEMPDATA: mensajes flash que viven solo 1 petición ----
  app.use(flash());
  app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.flashSuccess = req.flash('success');
    res.locals.flashError = req.flash('error');
    res.locals.seccion = req.path.split('/')[1] || ''; // para marcar el menú activo
    next();
  });

  // ---- RUTAS ----
  app.use('/', require('./routes/auth'));
  app.use('/panel', requireAuth, require('./routes/panel'));
  app.use('/cursos', requireAuth, require('./routes/cursos'));
  app.use('/desempeno', requireAuth, require('./routes/desempeno'));
  app.use('/donaciones', requireAuth, require('./routes/donaciones'));
  app.use('/estudio', requireAuth, require('./routes/estudio'));

  app.use((req, res) => {
    res.status(404).render('error', { title: 'Página no encontrada', codigo: 404, mensaje: 'La página que buscas no existe.' });
  });
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('error', { title: 'Error', codigo: 500, mensaje: 'Algo falló en el servidor. Revisa la terminal para ver el detalle.' });
  });

  require('./sockets')(io);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => console.log(`🚀 MasterEstudio en http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error('❌ No se pudo iniciar la app:', err.message);
  process.exit(1);
});
