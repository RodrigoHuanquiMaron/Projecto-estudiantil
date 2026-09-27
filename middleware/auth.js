// Protege las páginas privadas: si no hay sesión, manda al login
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  req.flash('error', 'Inicia sesión para continuar.');
  res.redirect('/login');
}

// Si ya inició sesión, no tiene sentido mostrarle el login
function guestOnly(req, res, next) {
  if (req.session.user) return res.redirect('/panel');
  next();
}

module.exports = { requireAuth, guestOnly };
