// Penales: el juego (pantallas, teclas, penales, tanda, copa y práctica).
(function () {
  'use strict';
  const P = window.Penales, S = window.Sonido;
  const Q = new URLSearchParams(location.search);
  const PRUEBA = Q.has('prueba');
  const VEL = PRUEBA ? (Number(Q.get('prueba')) || 20) : 1;
  if (PRUEBA) S.apagar();
  const $ = s => document.querySelector(s);
  const col = P.col, fila = P.fila;

  const AL = {
    aI: 'al ángulo izquierdo', aC: 'arriba al medio', aD: 'al ángulo derecho',
    mI: 'a la izquierda', mC: 'al medio', mD: 'a la derecha',
    bI: 'abajo a la izquierda', bC: 'abajo al medio', bD: 'abajo a la derecha'
  };
  const ZONA_CORTA = {
    aI: 'Ángulo izquierdo', aC: 'Arriba', aD: 'Ángulo derecho', mI: 'Izquierda', mC: 'Medio',
    mD: 'Derecha', bI: 'Abajo izquierda', bC: 'Abajo', bD: 'Abajo derecha'
  };
  const RONDAS = ['Octavos de final', 'Cuartos de final', 'Semifinal', 'Final'];
  const RONDA_EN = ['octavos de final', 'cuartos de final', 'la semifinal', 'la final'];
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

  class Cancelado extends Error {}
  const J = {
    token: 0, fase: 'menu', modo: null, nivel: 2, flechas: { arriba: false, abajo: false, izq: false, der: false },
    mem: P.nuevaMemoria(), tanda: null, rival: null, copa: null, practica: null, bucle: null,
    patear: null, atajar: null, ultimo: '', jugando: false
  };
  window.__penales = J;

  function esperar(ms) {
    const tk = J.token;
    return new Promise((res, rej) => setTimeout(() => (tk === J.token ? res() : rej(new Cancelado())), ms / VEL));
  }
  const ahora = () => performance.now() * VEL / 1000;
  function chequear(tk) { if (tk !== J.token) throw new Cancelado(); }

  // ---- Lector de pantalla ----
  let alterno = false;
  function anunciar(t) {
    J.ultimo = t;
    const a = $('#aviso1'), b = $('#aviso2');
    const usar = alterno ? b : a, otro = alterno ? a : b;
    alterno = !alterno;
    otro.textContent = '';
    usar.textContent = t;
    $('#textoVisible').textContent = t;
  }

  // ---- Pantallas ----
  function mostrar(id) {
    for (const s of ['inicio', 'juego', 'fin', 'pausa', 'ayuda', 'online']) $('#' + s).hidden = s !== id && !(id === 'pausa' && s === 'juego') && !(id === 'fin' && s === 'juego');
    document.body.dataset.pantalla = id;
  }

  // ---- Vista (para los que ven) ----
  const X = { I: 125, C: 200, D: 275 }, Y = { a: 88, m: 122, b: 160 };
  function destinoDe(t) {
    const c = col(t.zona), f = fila(t.zona);
    const d = { x: X[c], y: Y[f], pan: S.PAN[c], frec: f };
    if (t.picada) { d.x = 200; d.y = 104; d.frec = 'p'; d.pan = 0; }
    if (t.resultado === 'afuera') { d.x = c === 'I' ? 48 : 352; d.pan = c === 'I' ? -1 : 1; }
    if (t.resultado === 'arriba') { d.y = 36; d.frec = 'x'; }
    if (t.resultado === 'palo') d.x = c === 'I' ? 80 : 320;
    if (t.resultado === 'travesaño') d.y = 64;
    return d;
  }
  function verPelota(d, dur) {
    const p = $('#pelota');
    p.style.transition = `transform ${dur / VEL}s cubic-bezier(.25,.7,.45,1)`;
    const s = 0.55;
    p.style.transform = `translate(${d.x - 200}px, ${d.y - 262}px) scale(${s})`;
  }
  function verArquero(z) {
    const a = $('#arquero');
    let t = '';
    if (z === 'aC') t = 'translate(0px,-26px)';
    else if (z === 'bC') t = 'translate(0px,10px) scale(1.1,0.8)';
    else if (z !== 'mC') {
      const dx = (X[col(z)] - 200) * 0.95, dy = (Y[fila(z)] - 140) * 0.9;
      t = `translate(${dx}px,${dy}px) rotate(${col(z) === 'I' ? -72 : 72}deg)`;
    }
    a.style.transform = t;
  }
  function verMira(z) {
    const m = $('#mira');
    m.style.display = '';
    m.setAttribute('transform', `translate(${X[col(z)]},${Y[fila(z)]})`);
  }
  function reiniciarVista(modo) {
    const p = $('#pelota');
    p.style.transition = 'none'; p.style.transform = '';
    $('#arquero').style.transform = '';
    $('#mira').style.display = modo === 'patear' ? '' : 'none';
    if (modo === 'patear') verMira('mC');
    $('#cancha').dataset.modo = modo;
    $('#cartel').textContent = '';
    $('#fuerza').style.width = '0%';
    $('#barraFuerza').hidden = modo !== 'patear';
  }
  function cartel(t, bueno) {
    const c = $('#cartel'); c.textContent = t; c.dataset.bueno = bueno ? '1' : '0';
    c.classList.remove('salta'); void c.getBBox?.(); c.classList.add('salta');
  }

  function pintarMarcador() {
    const t = J.tanda;
    $('#eq1').textContent = J.rival ? J.rival.nombre : 'Arquero';
    for (const e of [0, 1]) {
      const cont = $('#p' + e);
      cont.textContent = '';
      const tiros = t ? t.goles[e] : [];
      const n = Math.max(5, tiros.length);
      for (let i = 0; i < n; i++) {
        const s = document.createElement('span');
        s.className = 'tiro ' + (i < tiros.length ? (tiros[i] ? 'gol' : 'nogol') : '');
        cont.appendChild(s);
      }
      $('#g' + e).textContent = t ? t.cuenta(e) : 0;
    }
    if (J.practica) {
      $('#p0').textContent = ''; $('#p1').textContent = '';
      $('#g0').textContent = J.practica.buenos; $('#g1').textContent = J.practica.total;
      $('#eq0').textContent = J.modo === 'pp' ? 'Goles' : 'Atajadas';
      $('#eq1').textContent = 'Penales';
    } else $('#eq0').textContent = 'Vos';
  }
  function marcadorCorto() { const t = J.tanda; return `${t.cuenta(0)} a ${t.cuenta(1)}.`; }
  function decirMarcador() {
    if (J.practica) {
      anunciar(`${J.modo === 'pp' ? 'Goles' : 'Atajadas'}: ${J.practica.buenos} de ${J.practica.total}.`);
      return;
    }
    const t = J.tanda; if (!t) return;
    let txt = `Vos ${t.cuenta(0)} de ${t.tiros(0)}. ${J.rival.nombre} ${t.cuenta(1)} de ${t.tiros(1)}.`;
    if (t.muerteSubita()) txt += ' Muerte súbita.';
    if (J.copa) txt = RONDAS[J.copa.ronda] + '. ' + txt;
    anunciar(txt);
  }

  // ---- Teclas ----
  const FLECHA = { ArrowUp: 'arriba', ArrowDown: 'abajo', ArrowLeft: 'izq', ArrowRight: 'der' };
  const AYUDA = 'Patear: mantené Espacio para correr y cargar la fuerza, y soltalo para patear. ' +
    'Cada flecha mueve la mira un lugar, sin mantenerla. Arranca al medio. P la picás. A hace la paradinha. ' +
    'Atajar: cada flecha mueve al arquero un lugar, en cualquier orden. Sin tocar nada te quedás en el medio. ' +
    'M marcador, R repetir, Escape pausa.';

  function enJuego() { return document.body.dataset.pantalla === 'juego'; }

  document.addEventListener('keydown', e => {
    if (!enJuego()) return;
    const fl = FLECHA[e.key];
    if (fl) {
      e.preventDefault();
      if (e.repeat) return;
      J.flechas[fl] = true;
      if (J.patear && J.patear.fase !== 'pateado') moverMira(fl);
      else if (J.atajar) apretoAtajar(fl);
      return;
    }
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) teclaPatear('espacio', true); return; }
    if (e.repeat) return;
    if (e.code === 'KeyP') { teclaPatear('picar', true); return; }
    if (e.code === 'KeyA') { teclaPatear('paradinha', true); return; }
    if (e.code === 'KeyM') { decirMarcador(); return; }
    if (e.code === 'KeyR') { anunciar(J.ultimo); return; }
    if (e.code === 'KeyH') { anunciar(AYUDA); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); pausar(); }
  });
  document.addEventListener('keyup', e => {
    if (!enJuego()) return;
    const fl = FLECHA[e.key];
    if (fl) { J.flechas[fl] = false; return; }
    if (e.code === 'Space') teclaPatear('espacio', false);
  });
  window.addEventListener('blur', () => { for (const k in J.flechas) J.flechas[k] = false; });

  let ultimaMira = 'mC';
  J.mira = 'mC';
  // Cada flecha mueve la mira un lugar (arriba/medio/abajo, izquierda/medio/derecha).
  // Se puede apretar de a una: no hace falta mantener varias teclas juntas.
  function moverMira(fl) {
    const FI = ['a', 'm', 'b'], CO = ['I', 'C', 'D'];
    let f = FI.indexOf(fila(J.mira)), c = CO.indexOf(col(J.mira));
    if (fl === 'arriba') f = Math.max(0, f - 1);
    if (fl === 'abajo') f = Math.min(2, f + 1);
    if (fl === 'izq') c = Math.max(0, c - 1);
    if (fl === 'der') c = Math.min(2, c + 1);
    J.mira = FI[f] + CO[c];
    cambioMira(true);
  }
  function cambioMira(siempre) {
    const z = J.mira;
    if (z === ultimaMira && !siempre) return;
    ultimaMira = z;
    S.apuntar(z);
    verMira(z);
    if (J.practica) anunciar(ZONA_CORTA[z]);
  }

  // ---- Patear ----
  function teclaPatear(que, abajo) {
    const p = J.patear; if (!p) return;
    if (que === 'espacio') {
      if (abajo && p.fase === 'listo') empezarCarrera();
      else if (!abajo && p.fase === 'carrera') soltar(false);
    } else if (que === 'picar' && p.fase === 'carrera') soltar(true);
    else if (que === 'paradinha' && p.fase === 'carrera' && !p.paradinha) paradinha();
  }
  function empezarCarrera() {
    const p = J.patear;
    p.fase = 'carrera'; p.acum = 0; p.ult = ahora(); p.pasos = 0; p.pausaHasta = 0;
    p.carga = S.carga();
    S.paso(0.15);
    if (p.online) enviarOnline({ t: 'carrera' });
    p.timer = setInterval(() => {
      const t = ahora();
      if (t < p.pausaHasta) { p.ult = t; return; }
      p.acum += t - p.ult; p.ult = t;
      const f = p.acum / p.T;
      p.carga.poner(f);
      $('#fuerza').style.width = Math.min(100, f / 1.3 * 100) + '%';
      $('#fuerza').dataset.pasado = f > 1 ? '1' : '0';
      const n = Math.floor(p.acum / 0.3);
      if (n > p.pasos) { p.pasos = n; S.paso(Math.min(0.5, 0.18 + n * 0.07)); }
      if (f >= 1.3) soltar(false);
    }, 20);
  }
  function paradinha() {
    const p = J.patear;
    p.paradinha = true;
    p.pausaHasta = ahora() + 0.7;
    if (p.online) { enviarOnline({ t: 'paradinha' }); return; }
    if (Math.random() < p.arquero.nervios * 0.85) {
      const d = P.arqueroElige(p.arquero, J.mem);
      p.arqTemprano = d;
      setTimeout(() => { if (J.patear === p) { sonidoDive(d); verArquero(d); } }, 250 / VEL);
    }
  }
  function soltar(picada) {
    const p = J.patear;
    clearInterval(p.timer);
    p.carga.parar();
    p.fase = 'pateado';
    p.res({ zona: J.mira, fuerza: p.acum / p.T, picada, paradinha: p.paradinha, arqTemprano: p.arqTemprano });
  }
  function sonidoDive(d) {
    if (d === 'mC') return;
    if (d === 'aC') S.salto(); else S.estirada(S.PAN[col(d)]);
  }
  function textoFallo(t) {
    if (t.resultado === 'afuera') return `¡Afuera! Se fue por la ${col(t.zona) === 'I' ? 'izquierda' : 'derecha'}.`;
    if (t.resultado === 'arriba') return '¡Por arriba del travesaño!';
    if (t.resultado === 'palo') return '¡Palo!';
    return '¡Travesaño!';
  }
  function sonidoFallo(t, d) {
    if (t.resultado === 'palo' || t.resultado === 'travesaño') S.palo(d.pan);
    S.uhh();
  }
  const COMO_SE_TIRO = d => d === 'mC' ? 'se quedó parado' : d === 'aC' ? 'saltó arriba' : d === 'bC' ? 'se agachó' : 'se tiró ' + AL[d];

  async function penalPatea(o) {
    const tk = J.token;
    const arq = o.arquero;
    reiniciarVista('patear');
    ultimaMira = 'mC'; J.mira = 'mC';
    J.atajar = null; J.patear = null;
    anunciar(o.aviso + 'Te toca patear. Ataja ' + arq.nombre + '.');
    S.silbato();
    await esperar(900);
    chequear(tk);
    const pedido = await new Promise(res => {
      J.patear = { res, fase: 'listo', arquero: arq, T: 1.3 * (1 - 0.22 * o.presion), paradinha: false, arqTemprano: null };
      cambioMira();
    });
    chequear(tk);
    const tiro = P.resolverTiro({ ...pedido, presion: o.presion, precision: 1 });
    const adelantado = !!pedido.arqTemprano;
    const dive = pedido.arqTemprano || P.arqueroElige(arq, J.mem);
    J.mem.tiros[pedido.zona]++; J.mem.totalTiros++; if (pedido.picada) J.mem.picadas++;
    S.patada();
    const D = P.duracionVuelo(pedido.fuerza, pedido.picada, 2, 0) * 0.9;
    const d = destinoDe(tiro);
    S.pelota(D, d.pan, d.frec, false);
    verPelota(d, D);
    if (!adelantado) { sonidoDive(dive); verArquero(dive); }
    await esperar(D * 1000);
    chequear(tk);
    let gol = false, texto;
    if (tiro.resultado === 'arco') {
      const p = P.probAtajada({ dive, ball: tiro.zona, fuerza: pedido.fuerza, adelantado, tarde: 0, picada: tiro.picada, reflejos: arq.reflejos, grandote: arq.grandote });
      if (Math.random() < p) {
        S.guantes(d.pan); S.uhh(); S.mal(); cartel('¡ATAJÓ!', false);
        texto = tiro.picada ? `¡Te atajó la picada ${arq.nombre}!` : `Te lo atajó ${arq.nombre}. Pateaste ${AL[tiro.zona]}.`;
      } else {
        gol = true; S.red(d.pan); S.festejo(); S.bien(); cartel('¡GOL!', true);
        texto = tiro.picada ? '¡Gol! La picaste.' : `¡Gol! ${cap(AL[tiro.zona])}.`;
      }
    } else {
      sonidoFallo(tiro, d); S.mal(); cartel(tiro.resultado === 'palo' ? '¡PALO!' : tiro.resultado === 'travesaño' ? '¡TRAVESAÑO!' : '¡AFUERA!', false);
      texto = textoFallo(tiro);
    }
    if (tiro.debil) texto += ' Muy despacio.';
    if (o.practica) {
      texto += ` Fuerza ${Math.round(pedido.fuerza * 100)}${pedido.fuerza > 1 ? ', te pasaste' : ''}.`;
      texto += ` El arquero ${COMO_SE_TIRO(dive)}${adelantado && dive !== 'mC' ? ' antes' : ''}.`;
    }
    J.patear = null;
    return { gol, texto, bueno: gol };
  }

  // ---- Atajar ----
  // Atajar: cada flecha mueve al arquero un lugar desde el medio, en cualquier orden
  // (arriba y derecha, o derecha y arriba, da el ángulo derecho). Si apretaste una sin querer,
  // la flecha contraria la deshace. Para llegar a tiempo cuenta el último cambio,
  // salvo que las flechas vayan casi juntas (un cuarto de segundo).
  function apretoAtajar(fl) {
    const a = J.atajar;
    if (!a || (a.fase !== 'carrera' && a.fase !== 'vuelo')) return;
    const FI = ['a', 'm', 'b'], CO = ['I', 'C', 'D'];
    const z = a.dive || 'mC';
    let f = FI.indexOf(fila(z)), c = CO.indexOf(col(z));
    if (fl === 'arriba') f = Math.max(0, f - 1);
    if (fl === 'abajo') f = Math.min(2, f + 1);
    if (fl === 'izq') c = Math.max(0, c - 1);
    if (fl === 'der') c = Math.min(2, c + 1);
    const nueva = FI[f] + CO[c];
    if (nueva === z) return;
    const t = ahora();
    if (!a.primera || t - a.primera > 0.25) a.primera = t;
    a.dive = nueva === 'mC' ? null : nueva;
    a.diveT = a.primera;
    if (a.online && a.fase === 'carrera') enviarOnline({ t: 'dive', dive: nueva });
    if (nueva === 'mC') verArquero('mC'); else { sonidoDive(nueva); verArquero(nueva); }
  }
  function finalizarDive() {}

  async function penalAtaja(o) {
    const tk = J.token;
    const pat = o.pateador;
    reiniciarVista('atajar');
    J.patear = null;
    const a = J.atajar = { dive: null, diveT: null, combo: null, fase: 'espera' };
    anunciar(o.aviso + 'Patea ' + pat.nombre + '.');
    S.silbato();
    await esperar(1000);
    chequear(tk);
    let plan = P.pateadorElige(pat, J.mem);
    a.fase = 'carrera';
    const n = 5;
    let reacciono = false;
    for (let i = 0; i < n; i++) {
      S.paso(0.12 + i * 0.08);
      if (i === n - 2 && plan.paradinha) await esperar(750);
      const iv = plan.ritmo * (pat.irregular ? 0.7 + Math.random() * 0.6 : 1);
      await esperar(iv * 1000);
      if (!reacciono && a.dive && i < n - 1) { reacciono = true; plan = P.reaccionarAdelanto(pat, plan, a.dive); }
    }
    chequear(tk);
    const tk0 = ahora();
    a.fase = 'vuelo';
    const tiro = P.resolverTiro({ zona: plan.zona, fuerza: plan.fuerza, picada: plan.picada, paradinha: plan.paradinha, presion: o.presion, precision: pat.precision });
    const D = P.duracionVuelo(plan.fuerza, plan.picada, o.nivel, o.presion);
    a.llegada = tk0 + D;
    S.patada();
    const d = destinoDe(tiro);
    S.pelota(D, d.pan, d.frec, true);
    verPelota(d, D);
    await esperar(D * 1000);
    chequear(tk);
    if (a.combo) finalizarDive(a);
    a.fase = 'fin';
    const dive = a.dive || 'mC';
    const adelantado = !!a.dive && a.diveT < tk0;
    const tarde = a.dive ? Math.max(0, a.diveT + P.ALCANCE[dive] - a.llegada) : 0;
    J.mem.dives[dive]++; J.mem.totalDives++; if (adelantado) J.mem.adelantos++;
    let gol = false, texto;
    if (tiro.resultado === 'arco') {
      const p = P.probAtajada({ dive, ball: tiro.zona, fuerza: plan.fuerza, adelantado, tarde, picada: tiro.picada });
      if (Math.random() < p) {
        S.guantes(d.pan); S.festejo(); S.bien(); cartel('¡ATAJASTE!', true);
        texto = tiro.picada ? '¡Le atajaste la picada!' : '¡Atajaste!';
      } else {
        gol = true; S.red(d.pan); S.lamento(); S.mal(); cartel('GOL', false);
        texto = tiro.picada ? `Gol de ${pat.nombre}. Te la picó.` : `Gol de ${pat.nombre}, ${AL[tiro.zona]}.`;
        if (tarde > 0 && P.cobertura(dive, tiro.zona) > 0) texto += ' Llegaste tarde.';
      }
    } else {
      sonidoFallo(tiro, d); S.bien(); cartel(tiro.resultado === 'palo' ? '¡PALO!' : tiro.resultado === 'travesaño' ? '¡TRAVESAÑO!' : '¡AFUERA!', true);
      texto = textoFallo(tiro);
    }
    if (o.practica) {
      if (tiro.resultado === 'arco' && gol && !tiro.picada) texto += '';
      texto += a.dive ? ` Te tiraste ${AL[dive]}${adelantado ? ', antes de la patada' : ''}.` : ' Te quedaste parado.';
      if (plan.paradinha) texto += ' Hizo paradinha.';
    }
    J.atajar = null;
    return { gol, texto, bueno: !gol };
  }

  // ---- Toque (celular) ----
  (function toques() {
    const zona = $('#cancha');
    let ini = null;
    const UMBRAL = 30;
    function flechasDe(dx, dy) {
      return { izq: dx < -UMBRAL, der: dx > UMBRAL, arriba: dy < -UMBRAL, abajo: dy > UMBRAL };
    }
    zona.addEventListener('pointerdown', e => {
      if (!enJuego()) return;
      e.preventDefault();
      if (J.patear && J.patear.fase === 'carrera' && ini && e.pointerId !== ini.id) { teclaPatear('picar', true); return; }
      ini = { x: e.clientX, y: e.clientY, id: e.pointerId };
      if (J.patear && J.patear.fase === 'listo') { Object.assign(J.flechas, flechasDe(0, 0)); teclaPatear('espacio', true); }
    });
    zona.addEventListener('pointermove', e => {
      if (!ini || e.pointerId !== ini.id) return;
      const f = flechasDe(e.clientX - ini.x, e.clientY - ini.y);
      if (J.patear && J.patear.fase !== 'pateado') { J.mira = P.zonaDeFlechas(f); cambioMira(); }
      else if (J.atajar && (f.izq || f.der || f.arriba || f.abajo)) {
        const a = J.atajar, z = P.zonaDeFlechas(f);
        if ((a.fase === 'carrera' || a.fase === 'vuelo') && z !== (a.dive || 'mC')) {
          a.primera = a.primera && ahora() - a.primera < 0.25 ? a.primera : ahora();
          a.dive = z; a.diveT = a.primera;
          if (a.online && a.fase === 'carrera') enviarOnline({ t: 'dive', dive: z });
          sonidoDive(z); verArquero(z);
        }
      }
    });
    const fin = e => {
      if (!ini || e.pointerId !== ini.id) return;
      if (J.patear && J.patear.fase === 'carrera') teclaPatear('espacio', false);
      ini = null;
      for (const k in J.flechas) J.flechas[k] = false;
    };
    zona.addEventListener('pointerup', fin);
    zona.addEventListener('pointercancel', fin);
  })();

  // ---- Tanda ----
  async function bucleTanda() {
    const t = J.tanda, r = J.rival;
    if (!J.sorteoDicho) {
      J.sorteoDicho = true;
      const intro = J.copa ? `${RONDAS[J.copa.ronda]} contra ${r.nombre}. ` : `Contra ${r.nombre}. `;
      anunciar(intro + (t.primero === 0 ? 'Pateás primero vos.' : 'Patean primero ellos.'));
      await esperar(2600);
    }
    while (!t.terminada()) {
      const eq = t.quienPatea();
      const decisivo = t.esDecisivo(eq);
      const presion = decisivo ? 1 : Math.min(0.7, (t.tiros(0) + t.tiros(1)) * 0.07 + (J.copa ? J.copa.ronda * 0.08 : 0));
      S.presion(presion); S.corazon(decisivo);
      let aviso = '';
      if (t.muerteSubita() && !J.muerteDicha) { aviso = 'Muerte súbita. '; J.muerteDicha = true; }
      if (decisivo) aviso += 'Penal decisivo. ';
      let res;
      try {
        res = eq === 0
          ? await penalPatea({ arquero: r.arquero, presion, aviso })
          : await penalAtaja({ pateador: r.pateadores[t.tiros(1) % 5], nivel: J.nivel, presion, aviso });
      } finally { S.corazon(false); }
      t.registrar(eq, res.gol);
      pintarMarcador();
      const fin = t.terminada();
      anunciar(res.texto + (fin ? '' : ' ' + marcadorCorto()));
      await esperar(fin ? 1800 : 2700);
    }
    S.presion(0.1);
    return t.ganador();
  }

  function nuevaTanda(rival) {
    J.rival = rival;
    J.tanda = new P.Tanda(Math.random() < 0.5 ? 0 : 1);
    J.sorteoDicho = false; J.muerteDicha = false;
    J.mem = P.nuevaMemoria();
    pintarMarcador();
  }

  async function modoTanda() {
    const g = await bucleTanda();
    const t = J.tanda;
    const res = `${t.cuenta(0)} a ${t.cuenta(1)}`;
    if (g === 0) { S.ganarTanda(); finPantalla('¡Ganaste!', `Ganaste la tanda ${res}.`, 'Jugar otra tanda', () => empezar('tanda')); }
    else { S.perderTanda(); finPantalla('Perdiste', `Perdiste la tanda ${res}.`, 'Jugar otra tanda', () => empezar('tanda')); }
  }

  async function modoCopa() {
    const c = J.copa;
    if (!J.tanda) nuevaTanda(c.rivales[c.ronda]);
    J.nivel = c.rivales[c.ronda].nivel;
    $('#ronda').textContent = RONDAS[c.ronda];
    const g = await bucleTanda();
    const t = J.tanda;
    const res = `${t.cuenta(0)} a ${t.cuenta(1)}`;
    J.tanda = null;
    if (g === 1) {
      S.perderTanda();
      finPantalla('Quedaste afuera', `Perdiste ${res} contra ${c.rivales[c.ronda].nombre}. Quedaste afuera en ${RONDA_EN[c.ronda]}.`, 'Jugar otra copa', () => empezar('copa'));
      return;
    }
    c.ronda++;
    if (c.ronda >= RONDAS.length) {
      S.ganarTanda();
      finPantalla('¡Campeón!', `Ganaste la final ${res}. ¡Sos campeón de la Copa!`, 'Jugar otra copa', () => empezar('copa'));
      return;
    }
    S.ganarTanda();
    finPantalla('¡Pasaste!', `Ganaste ${res}. Pasás a ${RONDA_EN[c.ronda]} contra ${c.rivales[c.ronda].nombre}.`, 'Seguir', () => { mostrar('juego'); enfocarJuego(); correr(modoCopa); });
  }

  async function modoPractica() {
    const pr = J.practica;
    while (true) {
      let res;
      if (J.modo === 'pp') res = await penalPatea({ arquero: J.rival.arquero, presion: 0, aviso: '', practica: true });
      else res = await penalAtaja({ pateador: J.rival.pateadores[pr.total % 5], nivel: 1, presion: 0, aviso: '', practica: true });
      pr.total++; if (res.bueno) pr.buenos++;
      pintarMarcador();
      anunciar(res.texto);
      await esperar(3000);
    }
  }

  // ---- Online (uno contra uno con código) ----
  const Online = { ws: null, yo: 0, nombres: ['', ''], presion: 0 };
  const rivalOn = () => Online.nombres[1 - Online.yo] || 'tu rival';
  function urlServidor() {
    if (Q.get('servidor')) return Q.get('servidor');
    if (location.protocol === 'https:' || location.protocol === 'http:') return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    return 'wss://penales.onrender.com/ws';
  }
  function estadoOnline(t) { $('#oEstado').textContent = t; anunciar(t); }
  function enviarOnline(m) { const w = Online.ws; if (w && w.readyState === 1) w.send(JSON.stringify(m)); }
  function cerrarOnline() { const w = Online.ws; Online.ws = null; J.online = null; if (w) try { w.close(); } catch (e) {} }

  function conectarOnline(primero) {
    S.iniciar();
    cerrarOnline();
    let ws;
    try { ws = new WebSocket(urlServidor()); } catch (e) { estadoOnline('No se pudo conectar.'); return; }
    Online.ws = ws; J.online = Online;
    estadoOnline('Conectando. Si el servidor estaba dormido puede tardar un minuto.');
    ws.onopen = () => ws.send(JSON.stringify(primero));
    ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } if (Online.ws === ws) mensajeOnline(m); };
    ws.onclose = () => {
      if (Online.ws !== ws) return;
      Online.ws = null; J.online = null;
      if (document.body.dataset.pantalla === 'online') estadoOnline('No se pudo conectar con el servidor.');
      else if (J.modo === 'online' && !(J.tanda && J.tanda.terminada())) finPantalla('Se cortó', 'Se cortó la conexión con el servidor.', 'Jugar online', abrirOnline);
    };
  }

  function localGoles(g) { return [g[Online.yo].slice(), g[1 - Online.yo].slice()]; }

  function mensajeOnline(m) {
    if (m.t === 'sala') {
      Online.yo = m.yo;
      if (m.yo === 0) estadoOnline('Mesa creada. Código ' + m.codigo.split('').join(' ') + '. Pasáselo a tu rival y esperá que entre.');
      else estadoOnline('Entraste a la mesa.');
    } else if (m.t === 'error') {
      estadoOnline(m.texto);
    } else if (m.t === 'empieza') {
      Online.yo = m.yo; Online.nombres = m.nombres;
      detenerTodo();
      J.modo = 'online'; J.copa = null; J.practica = null; J.online = Online;
      J.rival = { nombre: rivalOn() };
      J.tanda = new P.Tanda(m.primero === m.yo ? 0 : 1);
      $('#ronda').textContent = 'Online';
      mostrar('juego'); enfocarJuego(); pintarMarcador();
      S.presion(0.15);
      anunciar(`Contra ${rivalOn()}. ${m.primero === m.yo ? 'Pateás primero vos.' : 'Patea primero ' + rivalOn() + '.'}`);
    } else if (m.t === 'penal') {
      if (document.body.dataset.pantalla !== 'juego') { mostrar('juego'); enfocarJuego(); }
      J.token++;
      Online.presion = m.presion;
      S.presion(m.presion); S.corazon(m.decisivo);
      const aviso = (m.muerte ? 'Muerte súbita. ' : '') + (m.decisivo ? 'Penal decisivo. ' : '');
      if (m.pateador === Online.yo) onlinePatea(aviso); else onlineAtaja(aviso);
    } else if (m.t === 'carrera') {
      const a = J.atajar; if (!a || !a.online || a.fase !== 'espera') return;
      a.fase = 'carrera'; a.pasos = 0; a.pausaHasta = 0;
      a.timer = setInterval(() => {
        if (ahora() < a.pausaHasta) return;
        a.pasos++; S.paso(Math.min(0.5, 0.12 + a.pasos * 0.07));
      }, 300 / VEL);
    } else if (m.t === 'paradinha') {
      const a = J.atajar; if (a && a.online) a.pausaHasta = ahora() + 0.7;
    } else if (m.t === 'dive') {
      if (J.patear && J.patear.online) { J.patear.diveVisto = true; sonidoDive(m.dive); verArquero(m.dive); }
    } else if (m.t === 'patada') {
      const d = destinoDe(m.tiro);
      if (J.atajar && J.atajar.online) {
        const a = J.atajar;
        clearInterval(a.timer);
        const tk0 = ahora();
        a.fase = 'vuelo'; a.tiro = m.tiro;
        S.patada(); S.pelota(m.D, d.pan, d.frec, true); verPelota(d, m.D);
        const tok = J.token;
        setTimeout(() => {
          if (tok !== J.token || J.atajar !== a) return;
          if (a.combo) finalizarDive(a);
          a.fase = 'fin';
          enviarOnline({ t: 'atajada', dive: a.dive, rel: a.dive ? a.diveT - tk0 : null });
        }, m.D * 1000 / VEL);
      } else if (J.patear && J.patear.online) {
        S.pelota(m.D * 0.9, d.pan, d.frec, false); verPelota(d, m.D * 0.9);
      }
    } else if (m.t === 'resultado') {
      S.corazon(false);
      const yoPateo = m.pateador === Online.yo;
      const tiro = m.tiro, dive = m.dive, d = destinoDe(tiro);
      const diveYaSono = yoPateo ? (J.patear && J.patear.diveVisto) : true;
      if (yoPateo && !diveYaSono) { sonidoDive(dive); verArquero(dive); }
      J.patear = null; J.atajar = null;
      J.tanda.goles = localGoles(m.goles);
      pintarMarcador();
      let texto;
      if (yoPateo) {
        if (tiro.resultado !== 'arco') { sonidoFallo(tiro, d); S.mal(); cartel('¡' + (tiro.resultado === 'palo' ? 'PALO' : tiro.resultado === 'travesaño' ? 'TRAVESAÑO' : 'AFUERA') + '!', false); texto = textoFallo(tiro); }
        else if (m.gol) { S.red(d.pan); S.festejo(); S.bien(); cartel('¡GOL!', true); texto = tiro.picada ? '¡Gol! La picaste.' : `¡Gol! ${cap(AL[tiro.zona])}.`; }
        else { S.guantes(d.pan); S.uhh(); S.mal(); cartel('¡ATAJÓ!', false); texto = tiro.picada ? `¡Te atajó la picada ${rivalOn()}!` : `Te lo atajó ${rivalOn()}. Pateaste ${AL[tiro.zona]}.`; }
      } else {
        if (tiro.resultado !== 'arco') { sonidoFallo(tiro, d); S.bien(); cartel('¡' + (tiro.resultado === 'palo' ? 'PALO' : tiro.resultado === 'travesaño' ? 'TRAVESAÑO' : 'AFUERA') + '!', true); texto = textoFallo(tiro); }
        else if (m.gol) {
          S.red(d.pan); S.lamento(); S.mal(); cartel('GOL', false);
          texto = tiro.picada ? `Gol de ${rivalOn()}. Te la picó.` : `Gol de ${rivalOn()}, ${AL[tiro.zona]}.`;
          if (m.tarde > 0 && P.cobertura(dive, tiro.zona) > 0) texto += ' Llegaste tarde.';
        } else { S.guantes(d.pan); S.festejo(); S.bien(); cartel('¡ATAJASTE!', true); texto = tiro.picada ? '¡Le atajaste la picada!' : '¡Atajaste!'; }
      }
      if (tiro.debil && yoPateo) texto += ' Muy despacio.';
      anunciar(texto + (J.tanda.terminada() ? '' : ' ' + marcadorCorto()));
    } else if (m.t === 'fin') {
      J.tanda.goles = localGoles(m.goles);
      const t = J.tanda, gane = m.ganador === Online.yo;
      const res = `${t.cuenta(0)} a ${t.cuenta(1)}`;
      setTimeout(() => {
        if (gane) S.ganarTanda(); else S.perderTanda();
        finPantalla(gane ? '¡Ganaste!' : 'Perdiste', `${gane ? 'Le ganaste' : 'Perdiste'} ${res} contra ${rivalOn()}.`, 'Revancha', () => {
          enviarOnline({ t: 'revancha' });
          $('#finTexto').textContent = 'Esperando que ' + rivalOn() + ' acepte la revancha.';
          anunciar($('#finTexto').textContent);
        });
      }, 1500 / VEL);
    } else if (m.t === 'pideRevancha') {
      anunciar(rivalOn() + ' quiere la revancha.');
    } else if (m.t === 'rivalSeFue') {
      const w = Online.ws; Online.ws = null; J.online = null; if (w) try { w.close(); } catch (e) {}
      finPantalla('Se fue', rivalOn() + ' se fue de la mesa.', 'Jugar online', abrirOnline);
    }
  }

  function onlinePatea(aviso) {
    const tk = J.token;
    reiniciarVista('patear');
    ultimaMira = 'mC'; J.mira = 'mC';
    J.atajar = null; J.patear = null;
    anunciar(aviso + 'Te toca patear. Ataja ' + rivalOn() + '.');
    S.silbato();
    setTimeout(() => {
      if (tk !== J.token) return;
      J.patear = {
        online: true, fase: 'listo', paradinha: false, T: 1.3 * (1 - 0.22 * Online.presion),
        res: pedido => { S.patada(); enviarOnline({ t: 'patear', zona: pedido.zona, fuerza: pedido.fuerza, picada: pedido.picada, paradinha: pedido.paradinha }); }
      };
      cambioMira();
    }, 900 / VEL);
  }

  function onlineAtaja(aviso) {
    reiniciarVista('atajar');
    J.patear = null;
    J.atajar = { online: true, dive: null, diveT: null, combo: null, fase: 'espera' };
    anunciar(aviso + 'Patea ' + rivalOn() + '.');
    S.silbato();
  }

  function abrirOnline() {
    detenerTodo();
    cerrarOnline();
    J.modo = null; J.tanda = null;
    $('#oEstado').textContent = '';
    mostrar('online');
    try { $('#oNombre').value = localStorage.getItem('penales-nombre') || $('#oNombre').value; } catch (e) {}
    $('#oNombre').focus();
  }
  function guardarNombre() { try { localStorage.setItem('penales-nombre', $('#oNombre').value.trim()); } catch (e) {} }
  $('#bOnline').addEventListener('click', abrirOnline);
  $('#oCrear').addEventListener('click', () => { guardarNombre(); conectarOnline({ t: 'crear', nombre: $('#oNombre').value }); });
  $('#oUnirme').addEventListener('click', () => {
    const k = $('#oCodigo').value.replace(/\D/g, '');
    if (k.length !== 4) { estadoOnline('El código tiene 4 números.'); $('#oCodigo').focus(); return; }
    guardarNombre(); conectarOnline({ t: 'unirme', codigo: k, nombre: $('#oNombre').value });
  });
  $('#oCodigo').addEventListener('keydown', e => { if (e.key === 'Enter') $('#oUnirme').click(); });
  $('#oVolver').addEventListener('click', () => { cerrarOnline(); mostrar('inicio'); $('#bOnline').focus(); });

  // ---- Arranque, pausa y fin ----
  async function correr(fn) {
    J.bucle = fn;
    try { await fn(); } catch (e) { if (!(e instanceof Cancelado)) { console.error(e); } }
  }
  function enfocarJuego() { $('#zonaJuego').focus(); }

  function empezar(modo) {
    S.iniciar();
    J.token++;
    J.modo = modo; J.copa = null; J.practica = null; J.patear = null; J.atajar = null;
    $('#ronda').textContent = '';
    mostrar('juego');
    enfocarJuego();
    S.presion(0.15);
    if (modo === 'tanda') { J.nivel = 2; nuevaTanda(P.generarEquipo(2)); $('#ronda').textContent = 'Tanda de penales'; correr(modoTanda); }
    else if (modo === 'copa') {
      const nombres = P.mezclar(P.EQUIPOS, Math.random);
      J.copa = { ronda: 0, rivales: [1, 2, 3, 4].map((n, i) => P.generarEquipo(n, Math.random, nombres[i])) };
      J.tanda = null;
      correr(modoCopa);
    } else {
      J.nivel = 1; J.tanda = null;
      J.rival = P.generarEquipo(1);
      J.mem = P.nuevaMemoria();
      J.practica = { total: 0, buenos: 0 };
      $('#ronda').textContent = modo === 'pp' ? 'Práctica de pateo' : 'Práctica de atajar';
      pintarMarcador();
      correr(modoPractica);
    }
  }

  function detenerTodo() {
    J.token++;
    if (J.patear && J.patear.timer) { clearInterval(J.patear.timer); J.patear.carga && J.patear.carga.parar(); }
    J.patear = null; J.atajar = null;
    S.corazon(false);
    for (const k in J.flechas) J.flechas[k] = false;
  }

  function pausar() {
    if (J.modo === 'online') {
      mostrar('pausa'); $('#pausaTexto').hidden = false;
      anunciar('Menú. En online el partido sigue: Seguir para volver, o Volver al menú para irte de la mesa.');
      $('#pSeguir').focus();
      return;
    }
    $('#pausaTexto').hidden = true;
    detenerTodo();
    mostrar('pausa');
    anunciar('Pausa.');
    $('#pSeguir').focus();
  }
  function seguir() {
    mostrar('juego');
    enfocarJuego();
    if (J.modo === 'online') return;
    const fn = J.bucle;
    if (fn) correr(fn);
  }
  function alMenu() {
    detenerTodo();
    cerrarOnline();
    J.modo = null;
    S.presion(-1);
    J.tanda = null; J.copa = null; J.practica = null; J.rival = null;
    mostrar('inicio');
    $('#bTanda').focus();
  }
  let accionFin = null;
  function finPantalla(titulo, texto, boton, accion) {
    detenerTodo();
    accionFin = accion;
    $('#finTitulo').textContent = titulo;
    $('#finTexto').textContent = texto;
    $('#finSeguir').textContent = boton;
    mostrar('fin');
    anunciar(texto);
    $('#finSeguir').focus();
  }

  // ---- Tribuna dibujada ----
  (function tribuna() {
    const g = $('#tribuna');
    const colores = ['#e94f37', '#2e86de', '#f6c90e', '#ffffff', '#3ba55c', '#ff8c42', '#8e5bd6'];
    let html = '';
    for (let fy = 0; fy < 6; fy++) for (let x = 6 + (fy % 2) * 6; x < 400; x += 12) {
      html += `<circle cx="${x}" cy="${18 + fy * 13}" r="4.2" fill="${colores[(x * 7 + fy * 13) % colores.length]}" opacity="${0.75 + (fy % 3) * 0.08}"/>`;
    }
    g.innerHTML = html;
  })();

  $('#bTanda').addEventListener('click', () => empezar('tanda'));
  $('#bCopa').addEventListener('click', () => empezar('copa'));
  $('#bPracPatear').addEventListener('click', () => empezar('pp'));
  $('#bPracAtajar').addEventListener('click', () => empezar('pa'));
  $('#bAyuda').addEventListener('click', () => { mostrar('ayuda'); $('#ayudaVolver').focus(); });
  document.querySelectorAll('.sonidos button').forEach(b => b.addEventListener('click', () => {
    S.iniciar();
    if (b.dataset.mira) S.apuntar(b.dataset.mira);
    else S.pelota(0.8, S.PAN[b.dataset.lado || 'C'], b.dataset.pelota, true);
  }));
  $('#ayudaVolver').addEventListener('click', () => { mostrar('inicio'); $('#bAyuda').focus(); });
  $('#pSeguir').addEventListener('click', seguir);
  $('#pMenu').addEventListener('click', alMenu);
  $('#finSeguir').addEventListener('click', () => accionFin && accionFin());
  $('#finMenu').addEventListener('click', alMenu);
  document.addEventListener('keydown', e => {
    const pant = document.body.dataset.pantalla;
    if (e.key === 'Escape' && (pant === 'pausa')) { e.preventDefault(); seguir(); }
    else if (e.key === 'Escape' && pant === 'ayuda') { e.preventDefault(); mostrar('inicio'); $('#bAyuda').focus(); }
  });

  mostrar('inicio');
  setTimeout(() => $('#bTanda').focus(), 50);
})();
