// ===== Modo estudio: cronómetro, temporizador, alarma y reloj =====
(function () {
  const $ = (id) => document.getElementById(id);
  const display = $('display'), status = $('status');
  const btnStart = $('btn-start'), btnSave = $('btn-save'), btnReset = $('btn-reset');

  let modo = 'cronometro';
  let corriendo = false;
  let inicio = 0;          // performance.now() al iniciar
  let acumulado = 0;       // ms estudiados antes de la última pausa
  let objetivo = 25 * 60 * 1000; // temporizador
  let alarma = null;       // "HH:MM"
  let tick = null;

  const dos = (n) => String(n).padStart(2, '0');
  const transcurrido = () => acumulado + (corriendo ? performance.now() - inicio : 0);

  function pintar(ms) {
    ms = Math.max(0, ms);
    const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60,
      s = Math.floor(ms / 1000) % 60, cs = Math.floor(ms / 10) % 100;
    const principal = h ? `${dos(h)}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
    display.innerHTML = `${principal}<small>.${dos(cs)}</small>`;
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach((t) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.2, ctx.currentTime + t);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
      });
    } catch (e) { /* sin audio */ }
  }

  function loop() {
    if (modo === 'reloj') {
      const d = new Date();
      display.innerHTML = `${dos(d.getHours())}:${dos(d.getMinutes())}<small>:${dos(d.getSeconds())}</small>`;
      return;
    }
    if (modo === 'alarma') {
      const d = new Date();
      display.innerHTML = `${dos(d.getHours())}:${dos(d.getMinutes())}<small>:${dos(d.getSeconds())}</small>`;
      if (alarma && `${dos(d.getHours())}:${dos(d.getMinutes())}` === alarma) {
        alarma = null; beep(); status.textContent = '⏰ ¡Hora de estudiar!'; toast('⏰ Tu alarma sonó');
      }
      return;
    }
    if (modo === 'temporizador') {
      const restante = objetivo - transcurrido();
      pintar(restante);
      if (corriendo && restante <= 0) {
        pausar(); beep();
        status.textContent = '¡Tiempo cumplido! Guarda tu sesión.';
        toast('⏳ Temporizador terminado', 'ok');
      }
      return;
    }
    pintar(transcurrido());
  }

  function iniciar() { corriendo = true; inicio = performance.now(); btnStart.textContent = 'Pausar'; status.textContent = 'Estudiando… 📚'; }
  function pausar() { acumulado = transcurrido(); corriendo = false; btnStart.textContent = 'Continuar'; status.textContent = 'En pausa.'; }
  function reiniciar() { corriendo = false; acumulado = 0; btnStart.textContent = 'Iniciar'; status.textContent = 'Presiona Iniciar y concéntrate.'; loop(); }

  btnStart.addEventListener('click', () => (corriendo ? pausar() : iniciar()));
  btnReset.addEventListener('click', reiniciar);

  // Guardar sesión → WebSocket → PostgreSQL → actividad en vivo
  btnSave.addEventListener('click', () => {
    const segundos = Math.floor(transcurrido() / 1000);
    if (!window.socket || !window.socket.connected) {
      toast('Sin conexión en tiempo real. Recarga la página.', 'err'); return;
    }
    btnSave.disabled = true;
    window.socket.emit('estudio:guardar', { segundos, cursoId: $('curso').value }, (res) => {
      btnSave.disabled = false;
      if (!res || !res.ok) { toast((res && res.error) || 'No se pudo guardar.', 'err'); return; }
      status.textContent = `✅ Sesión de ${res.minutos} min guardada.`;
      reiniciar();
      status.textContent = `✅ Sesión de ${res.minutos} min guardada.`;
    });
  });

  // Cambio de modo (barra lateral)
  document.querySelectorAll('.study-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.study-tab').forEach((t) => t.classList.remove('on'));
      tab.classList.add('on');
      modo = tab.dataset.mode;
      $('presets').hidden = modo !== 'temporizador';
      $('alarma-box').hidden = modo !== 'alarma';
      const controles = modo === 'cronometro' || modo === 'temporizador';
      [btnStart, btnSave, btnReset].forEach((b) => { b.hidden = !controles; });
      if (controles) reiniciar(); else status.textContent = modo === 'alarma' ? 'Programa una hora para empezar a estudiar.' : '';
      loop();
    });
  });

  document.querySelectorAll('#presets [data-min]').forEach((b) => {
    b.addEventListener('click', () => { objetivo = Number(b.dataset.min) * 60000; reiniciar(); });
  });
  $('alarma-set').addEventListener('click', () => {
    alarma = $('alarma-hora').value || null;
    status.textContent = alarma ? `Alarma programada para las ${alarma}.` : 'Elige una hora.';
  });
  $('btn-full').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  // Aviso si intenta salir con tiempo sin guardar
  window.addEventListener('beforeunload', (e) => {
    if (transcurrido() > 10000 && (modo === 'cronometro' || modo === 'temporizador')) { e.preventDefault(); e.returnValue = ''; }
  });

  tick = setInterval(loop, 50);
  loop();
})();
