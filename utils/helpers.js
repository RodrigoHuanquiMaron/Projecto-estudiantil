// Funciones pequeñas que usan las vistas (disponibles como "h" en EJS)
function letra(n) {
  if (n === null || n === undefined) return 'N/A';
  if (n >= 93) return 'A';
  if (n >= 90) return 'A-';
  if (n >= 87) return 'B+';
  if (n >= 83) return 'B';
  if (n >= 80) return 'B-';
  if (n >= 77) return 'C+';
  if (n >= 70) return 'C';
  return 'D';
}

function nota(n) {
  if (n === null || n === undefined) return 'N/A';
  return `${letra(n)} (${Number(n).toFixed(1)}%)`;
}

function iniciales(nombre = '') {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

function soles(n) {
  return 'S/' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
function hace(fecha) {
  const seg = Math.round((new Date(fecha) - Date.now()) / 1000);
  const abs = Math.abs(seg);
  if (abs < 60) return 'hace un momento';
  if (abs < 3600) return rtf.format(Math.round(seg / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(seg / 3600), 'hour');
  if (abs < 2592000) return rtf.format(Math.round(seg / 86400), 'day');
  return new Date(fecha).toLocaleDateString('es-PE');
}

const ESTADOS = {
  en_curso: 'En curso',
  completado: 'Completado',
  no_iniciado: 'No iniciado',
};
const estado = (e) => ESTADOS[e] || e;

// Color de avatar estable según el nombre
const COLORES = ['#6366f1', '#0ea5e9', '#f59e0b', '#ec4899', '#10b981', '#8b5cf6', '#ef4444'];
function colorAvatar(nombre = '') {
  let s = 0;
  for (const ch of nombre) s += ch.charCodeAt(0);
  return COLORES[s % COLORES.length];
}

module.exports = { letra, nota, iniciales, soles, hace, estado, ESTADOS, colorAvatar };
