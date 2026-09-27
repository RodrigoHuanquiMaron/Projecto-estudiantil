// ===== JavaScript del navegador (todas las páginas) =====
(function () {
  const toasts = document.getElementById('toasts');

  const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function ocultar(el, ms) {
    setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 300); }, ms);
  }

  // Muestra una notificación flotante
  window.toast = function (texto, tipo = '') {
    if (!toasts) return;
    const el = document.createElement('div');
    el.className = 'toast ' + tipo;
    el.textContent = texto;
    toasts.appendChild(el);
    ocultar(el, 4500);
  };

  // Mensajes flash (TempData) que vienen del servidor: se ocultan solos
  document.querySelectorAll('.toast').forEach((el) => ocultar(el, 5000));

  // Mostrar / ocultar contraseña
  document.querySelectorAll('[data-toggle-pass]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  // Diálogo de donación
  document.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => document.getElementById(btn.dataset.open).showModal());
  });
  document.querySelectorAll('dialog [data-close]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('dialog').close());
  });
  document.querySelectorAll('[data-monto]').forEach((btn) => {
    btn.addEventListener('click', () => { document.getElementById('monto').value = btn.dataset.monto; });
  });

  // ===== WebSockets (Socket.IO) =====
  if (typeof io === 'undefined') return;
  const socket = io();
  window.socket = socket;

  const badge = document.getElementById('bell-badge');
  let pendientes = 0;
  function sumarNotificacion() {
    if (!badge) return;
    pendientes++;
    badge.textContent = pendientes;
    badge.hidden = false;
  }
  const bell = document.getElementById('bell');
  if (bell) bell.addEventListener('click', () => { pendientes = 0; badge.hidden = true; });

  socket.on('online', (n) => {
    const el = document.getElementById('online-count');
    if (el) el.textContent = n;
  });

  // Nueva actividad del propio usuario (ej.: guardó una sesión de estudio)
  socket.on('actividad:nueva', (a) => {
    sumarNotificacion();
    toast(`${a.descripcion}${a.detalle ? ' · ' + a.detalle : ''}`, 'ok');
    const lista = document.getElementById('lista-actividades');
    if (lista) {
      const vacio = lista.querySelector('.empty');
      if (vacio) vacio.remove();
      const li = document.createElement('li');
      li.className = 'new';
      li.innerHTML = `<span class="act-ico act-${escapar(a.tipo)}"></span>
        <div><p>${escapar(a.descripcion)}</p><small>${a.detalle ? escapar(a.detalle) + ' · ' : ''}${escapar(a.cuando)}</small></div>`;
      lista.prepend(li);
      while (lista.children.length > 5) lista.lastElementChild.remove();
    }
  });

  // Nueva donación de CUALQUIER usuario → todos la ven al instante
  socket.on('donacion:nueva', ({ donacion: d, stats, honor }) => {
    sumarNotificacion();
    toast(`💜 ${d.nombre} donó ${d.monto}`);

    const lista = document.getElementById('lista-donaciones');
    if (!lista) return;
    const li = document.createElement('li');
    li.className = 'card donation new';
    li.innerHTML = `<span class="avatar" style="background:${escapar(d.color)}">${escapar(d.iniciales)}</span>
      <div class="don-body">
        <div class="don-top"><strong>${escapar(d.nombre)}</strong><b>${escapar(d.monto)}</b></div>
        <small class="muted">${escapar(d.cuando)}</small>
        ${d.mensaje ? `<p class="quote">“${escapar(d.mensaje)}”</p>` : ''}
      </div>`;
    lista.prepend(li);
    while (lista.children.length > 8) lista.lastElementChild.remove();

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('st-total', stats.total);
    set('st-cantidad', stats.cantidad);
    set('st-promedio', stats.promedio);
    set('st-donantes', stats.donantes);

    const tabla = document.getElementById('tabla-honor');
    if (tabla) {
      tabla.innerHTML = honor.map((x, i) =>
        `<li><span class="pos">#${i + 1}</span><span class="name">${escapar(x.nombre)}</span><b>${escapar(x.total)}</b></li>`).join('');
    }
  });
})();
