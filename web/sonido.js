// Penales: todos los sonidos, hechos en el momento (sin archivos).
// Izquierda/derecha = oído izquierdo/derecho. Más agudo = más arriba.
(function (raiz) {
  'use strict';
  let ctx = null, master = null, ruidoBuf = null, hinchada = null, latido = null;
  let apagado = false;

  const PAN = { I: -0.85, C: 0, D: 0.85 };
  const ALTURA = { a: 880, m: 587, b: 392 };

  function iniciar() {
    if (apagado) return;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { apagado = true; return; }
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
      ruidoBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = ruidoBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      crearHinchada();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  function listo() { return !!ctx && !apagado; }

  function salida(pan) {
    const g = ctx.createGain();
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = pan || 0;
      g.connect(p); p.connect(master); g._pan = p.pan;
    } else g.connect(master);
    return g;
  }

  function tono(freq, dur, o = {}) {
    if (!listo()) return;
    const t = ctx.currentTime + (o.t || 0);
    const osc = ctx.createOscillator();
    osc.type = o.tipo || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.freqFin) osc.frequency.exponentialRampToValueAtTime(o.freqFin, t + dur);
    const g = salida(o.pan);
    const vol = o.vol == null ? 0.3 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.ataque || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); osc.start(t); osc.stop(t + dur + 0.05);
    return osc;
  }

  function ruido(dur, o = {}) {
    if (!listo()) return;
    const t = ctx.currentTime + (o.t || 0);
    const src = ctx.createBufferSource();
    src.buffer = ruidoBuf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.filtro || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.freqFin) f.frequency.exponentialRampToValueAtTime(o.freqFin, t + dur);
    f.Q.value = o.q == null ? 1 : o.q;
    const g = salida(o.pan);
    const vol = o.vol == null ? 0.3 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.ataque || 0.005));
    if (o.sostener) g.gain.setValueAtTime(vol, t + dur * o.sostener);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  // ---- Hinchada de fondo (sube con la presión) ----
  function crearHinchada() {
    const src = ctx.createBufferSource(); src.buffer = ruidoBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 650; f.Q.value = 0.5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 2200;
    const g = ctx.createGain(); g.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.23;
    const lg = ctx.createGain(); lg.gain.value = 0.012;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    src.connect(f); f.connect(f2); f2.connect(g); g.connect(master); src.start();
    hinchada = g;
  }
  function presion(p) {
    if (!listo()) return;
    hinchada.gain.setTargetAtTime(p < 0 ? 0 : 0.035 + p * 0.07, ctx.currentTime, 0.6);
  }
  function corazon(on) {
    if (latido) { clearInterval(latido); latido = null; }
    if (on && listo()) {
      const golpe = () => { tono(58, 0.12, { vol: 0.5 }); tono(52, 0.12, { vol: 0.35, t: 0.18 }); };
      golpe(); latido = setInterval(golpe, 850);
    }
  }

  // ---- Sonidos del juego ----
  function silbato() {
    if (!listo()) return;
    const t0 = ctx.currentTime;
    [[0, 0.18], [0.28, 0.5]].forEach(([d, dur]) => {
      const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 2600;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 28;
      const lg = ctx.createGain(); lg.gain.value = 140; lfo.connect(lg); lg.connect(osc.frequency);
      const g = salida(0);
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.16, t0 + d + 0.02);
      g.gain.setValueAtTime(0.16, t0 + d + dur - 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + dur);
      osc.connect(g); osc.start(t0 + d); lfo.start(t0 + d); osc.stop(t0 + d + dur + 0.05); lfo.stop(t0 + d + dur + 0.05);
    });
  }
  function paso(vol = 0.3) {
    ruido(0.07, { filtro: 'lowpass', freq: 500, vol: vol * 0.8 });
    tono(95, 0.06, { freqFin: 60, vol: vol });
  }
  function patada() {
    tono(170, 0.14, { freqFin: 45, vol: 0.85 });
    ruido(0.04, { filtro: 'highpass', freq: 1800, vol: 0.35 });
  }
  // La pelota viaja: acercándose (cuando atajás) o alejándose (cuando pateás).
  // Cada altura suena distinto:
  //  arriba (a): silbido agudo que va subiendo
  //  medio  (m): zumbido parejo de tono medio
  //  abajo  (b): ruido grave de pelota que pica y rueda por el pasto
  //  x: se va por arriba del travesaño (silbido muy agudo que se escapa)
  //  p: picada (sube y baja despacio)
  function pelota(dur, panFin, altura, acercandose) {
    if (!listo()) return;
    const t = ctx.currentTime;
    const g = salida(panFin * 0.45);
    const v0 = acercandose ? 0.08 : 0.4, v1 = acercandose ? 0.5 : 0.06;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v0, t + 0.03);
    g.gain.exponentialRampToValueAtTime(v1, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
    if (g._pan) { g._pan.setValueAtTime(panFin * 0.45, t); g._pan.linearRampToValueAtTime(panFin, t + dur * 0.6); }
    const fin = t + dur + 0.1;
    const osc = ctx.createOscillator();
    const go = ctx.createGain();
    osc.connect(go); go.connect(g);
    const src = ctx.createBufferSource(); src.buffer = ruidoBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    const gr = ctx.createGain();
    src.connect(f); f.connect(gr); gr.connect(g);
    if (altura === 'a' || altura === 'x') {
      const alto = altura === 'x';
      osc.type = 'sine';
      osc.frequency.setValueAtTime(alto ? 1500 : 1050, t);
      osc.frequency.exponentialRampToValueAtTime(alto ? 2600 : 1750, t + dur);
      const vib = ctx.createOscillator(); vib.frequency.value = 9;
      const vg = ctx.createGain(); vg.gain.value = 25; vib.connect(vg); vg.connect(osc.frequency);
      vib.start(t); vib.stop(fin);
      go.gain.value = 0.6;
      f.frequency.value = 3500; f.Q.value = 3; gr.gain.value = 0.25;
    } else if (altura === 'b') {
      osc.type = 'sawtooth'; osc.frequency.value = 75;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      osc.disconnect(); osc.connect(lp); lp.connect(go);
      go.gain.value = 0.9;
      f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 0.7; gr.gain.value = 0.7;
      // piques en el pasto
      for (let k = 0.06; k < dur - 0.02; k += 0.13) {
        const b = ctx.createOscillator(); b.frequency.setValueAtTime(110, t + k); b.frequency.exponentialRampToValueAtTime(55, t + k + 0.07);
        const bg = ctx.createGain(); bg.gain.setValueAtTime(0.0001, t + k); bg.gain.exponentialRampToValueAtTime(0.9, t + k + 0.005); bg.gain.exponentialRampToValueAtTime(0.0001, t + k + 0.08);
        b.connect(bg); bg.connect(g); b.start(t + k); b.stop(t + k + 0.1);
      }
    } else if (altura === 'p') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, t);
      osc.frequency.exponentialRampToValueAtTime(1100, t + dur * 0.5);
      osc.frequency.exponentialRampToValueAtTime(380, t + dur);
      go.gain.value = 0.5;
      f.frequency.value = 1200; f.Q.value = 1; gr.gain.value = 0.2;
    } else {
      osc.type = 'triangle'; osc.frequency.value = 520;
      const am = ctx.createOscillator(); am.frequency.value = 22;
      const ag = ctx.createGain(); ag.gain.value = 0.25; am.connect(ag); ag.connect(go.gain);
      am.start(t); am.stop(fin);
      go.gain.value = 0.5;
      f.frequency.value = 1300; f.Q.value = 1.5; gr.gain.value = 0.45;
    }
    osc.start(t); src.start(t, Math.random()); osc.stop(fin); src.stop(fin);
  }
  // Sonido de la mira: arriba = dos pitidos que suben; medio = un pitido; abajo = dos golpes graves que bajan.
  function apuntar(zona) {
    const pan = PAN[zona[1]], h = zona[0];
    if (h === 'a') {
      tono(1100, 0.09, { pan, vol: 0.22 });
      tono(1650, 0.13, { pan, vol: 0.22, t: 0.09 });
    } else if (h === 'b') {
      tono(160, 0.12, { pan, vol: 0.5, freqFin: 90 });
      tono(120, 0.14, { pan, vol: 0.5, freqFin: 65, t: 0.12 });
    } else {
      tono(600, 0.16, { pan, vol: 0.25, tipo: 'triangle' });
    }
  }
  // Fuerza: tono que sube mientras mantenés.
  function carga() {
    if (!listo()) return { poner() {}, parar() {} };
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 200;
    const osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 200;
    const g2 = ctx.createGain(); g2.gain.value = 0;
    const g = salida(0); g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.13, ctx.currentTime + 0.05);
    osc.connect(g); osc2.connect(g2); g2.connect(g); osc.start(); osc2.start();
    return {
      poner(f) {
        const fr = 200 * Math.pow(2, Math.min(f, 1.3) * 2.2);
        osc.frequency.setTargetAtTime(fr, ctx.currentTime, 0.02);
        osc2.frequency.setTargetAtTime(fr * 1.01, ctx.currentTime, 0.02);
        g2.gain.setTargetAtTime(f > 1 ? 0.1 : 0, ctx.currentTime, 0.02);
      },
      parar() {
        const t = ctx.currentTime;
        g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value || 0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        osc.stop(t + 0.08); osc2.stop(t + 0.08);
      }
    };
  }
  function estirada(pan) {
    ruido(0.28, { freq: 1600, freqFin: 500, vol: 0.28, pan });
    tono(75, 0.12, { freqFin: 50, vol: 0.45, pan, t: 0.3 });
  }
  function salto() { ruido(0.2, { freq: 900, freqFin: 1800, vol: 0.2 }); }
  function red(pan) {
    ruido(0.55, { freq: 3200, q: 0.6, vol: 0.28, pan });
    ruido(0.35, { filtro: 'lowpass', freq: 700, vol: 0.2, pan, t: 0.03 });
  }
  function guantes(pan) {
    tono(130, 0.12, { freqFin: 70, vol: 0.8, pan });
    ruido(0.06, { filtro: 'lowpass', freq: 900, vol: 0.45, pan });
  }
  function palo(pan) {
    [960, 1440, 2230, 3010].forEach((f, i) => tono(f, 1.1 - i * 0.2, { vol: 0.16 - i * 0.03, pan }));
  }
  function festejo() {
    ruido(2.6, { freq: 900, q: 0.4, vol: 0.5, ataque: 0.25, sostener: 0.4 });
    ruido(2.2, { freq: 2200, q: 0.5, vol: 0.15, ataque: 0.3, sostener: 0.3 });
  }
  function lamento() {
    ruido(1.4, { freq: 520, freqFin: 300, q: 1.2, vol: 0.3, ataque: 0.15 });
  }
  function uhh() {
    ruido(1.2, { freq: 480, freqFin: 360, q: 1.5, vol: 0.32, ataque: 0.1 });
  }
  // Cierres cortos para cada penal y para la tanda
  function bien() { tono(523, 0.18, { vol: 0.18, tipo: 'triangle' }); tono(784, 0.3, { vol: 0.18, tipo: 'triangle', t: 0.14 }); }
  function mal() { tono(330, 0.2, { vol: 0.18, tipo: 'triangle' }); tono(220, 0.35, { vol: 0.18, tipo: 'triangle', t: 0.16 }); }
  function ganarTanda() {
    [523, 659, 784, 1046].forEach((f, i) => tono(f, 0.35, { vol: 0.2, tipo: 'triangle', t: i * 0.13 }));
    festejo();
  }
  function perderTanda() {
    [440, 392, 349, 262].forEach((f, i) => tono(f, 0.4, { vol: 0.2, tipo: 'triangle', t: i * 0.17 }));
  }

  raiz.Sonido = {
    iniciar, apagar() { apagado = true; }, PAN, ALTURA, presion, corazon, silbato, paso, patada, pelota,
    apuntar, carga, estirada, salto, red, guantes, palo, festejo, lamento, uhh, bien, mal, ganarTanda, perderTanda
  };
})(window);
