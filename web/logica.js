// Penales: reglas, tiros, atajadas, rivales de la compu y tanda.
(function (raiz) {
  'use strict';

  const FILAS = ['a', 'm', 'b'];
  const COLS = ['I', 'C', 'D'];
  const ZONAS = ['aI', 'aC', 'aD', 'mI', 'mC', 'mD', 'bI', 'bC', 'bD'];
  const NOMBRE = {
    aI: 'ángulo izquierdo', aC: 'arriba al medio', aD: 'ángulo derecho',
    mI: 'a la izquierda', mC: 'al medio', mD: 'a la derecha',
    bI: 'abajo a la izquierda', bC: 'abajo al medio', bD: 'abajo a la derecha'
  };
  const fila = z => z[0];
  const col = z => z[1];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // Flechas apretadas -> zona. Sin nada = al medio (el arquero se queda parado).
  function zonaDeFlechas(f) {
    const fl = f.arriba && !f.abajo ? 'a' : f.abajo && !f.arriba ? 'b' : 'm';
    const c = f.izq && !f.der ? 'I' : f.der && !f.izq ? 'D' : 'C';
    return fl + c;
  }

  // Tiempo que tarda el arquero en llegar a cada zona (segundos).
  const ALCANCE = { mC: 0, bC: 0.12, aC: 0.14, mI: 0.2, mD: 0.2, bI: 0.22, bD: 0.22, aI: 0.3, aD: 0.3 };

  // Qué tan bien cubre el arquero (zona a la que se tiró) la zona de la pelota.
  function cobertura(d, b) {
    if (d === 'mC') return { mC: 0.95, bC: 0.92, aC: 0.45 }[b] || 0; // quieto: medio y abajo al centro
    if (d === 'bC') return { bC: 0.95, mC: 0.6 }[b] || 0;
    if (d === 'aC') return { aC: 0.92, mC: 0.6 }[b] || 0;
    if (col(d) !== col(b)) return 0;
    if (d === b) return fila(b) === 'a' ? 0.62 : fila(b) === 'b' ? 0.82 : 0.86;
    const dist = Math.abs(FILAS.indexOf(fila(d)) - FILAS.indexOf(fila(b)));
    return dist === 1 ? 0.42 : 0.1;
  }

  // Probabilidad de atajar.
  // o: {dive, ball, fuerza, adelantado, tarde(seg), picada, reflejos(0..1, solo compu), grandote}
  function probAtajada(o) {
    if (o.picada) return (o.dive === 'mC' || o.dive === 'aC' || o.dive === 'bC') ? 0.9 : 0;
    const f = Math.min(o.fuerza, 1.2);
    let p = cobertura(o.dive, o.ball);
    const distCol = Math.abs(COLS.indexOf(col(o.dive)) - COLS.indexOf(col(o.ball)));
    if (p === 0 && f < 0.35 && fila(o.dive) === fila(o.ball) && distCol === 1) p = 0.35;
    if (p > 0 && o.grandote) p += 0.1;
    p *= 1.18 - 0.42 * f;
    if (o.adelantado && fila(o.ball) === 'a' && col(o.ball) !== 'C') p += 0.1;
    if (p === 0 && o.reflejos && !(fila(o.ball) === 'a' && col(o.ball) !== 'C')) {
      p = o.reflejos * 0.3 * (1.1 - f);
    }
    if (o.tarde > 0) p *= o.tarde < 0.08 ? 0.45 : 0;
    return clamp(p, 0, 0.97);
  }

  // Lo que pasa con el tiro antes de llegar al arquero.
  // t: {zona, fuerza, picada, paradinha, presion(0..1), precision(1 normal; menos es mejor)}
  // resultado: 'arco' | 'afuera' | 'arriba' | 'palo' | 'travesaño'
  function resolverTiro(t, rng = Math.random) {
    const r = { zona: t.zona, pedida: t.zona, fuerza: t.fuerza, picada: !!t.picada, resultado: 'arco', debil: false };
    if (t.picada) {
      r.zona = 'mC';
      const fallo = (0.05 + (t.presion || 0) * 0.04) * (t.precision || 1);
      if (rng() < fallo) r.resultado = rng() < 0.5 ? 'travesaño' : 'arriba';
      return r;
    }
    let z = t.zona;
    const f = t.fuerza;
    if (f > 1) {
      const ex = f - 1;
      if (fila(z) === 'a') {
        if (rng() < 0.3 + ex * 2.2) { r.resultado = rng() < 0.2 ? 'travesaño' : 'arriba'; return r; }
      } else if (rng() < 0.45 + ex * 1.6) {
        z = (fila(z) === 'b' ? 'm' : 'a') + col(z);
      }
    }
    r.zona = z;
    if (f < 0.35) r.debil = true;
    const c = col(z), fl = fila(z);
    let m;
    if (c === 'C') m = fl === 'a' ? 0.05 : 0.01;
    else if (fl === 'a') m = 0.1 + Math.abs(f - 0.82) * 0.9;
    else if (fl === 'b') m = 0.05 + Math.abs(f - 0.8) * 0.45;
    else m = 0.04 + Math.abs(f - 0.8) * 0.3;
    m += (t.presion || 0) * 0.06 + (t.paradinha ? 0.05 : 0);
    m *= (t.precision || 1);
    if (rng() < m) {
      if (c === 'C') r.resultado = fl === 'a' ? 'travesaño' : 'arriba';
      else if (rng() < 0.38) r.resultado = (fl === 'a' && rng() < 0.4) ? 'travesaño' : 'palo';
      else r.resultado = 'afuera';
    }
    return r;
  }

  // Segundos que tarda la pelota en llegar al arco.
  function duracionVuelo(f, picada, nivel = 2, presion = 0) {
    if (picada) return 1.4;
    const base = 1.15 - 0.5 * Math.min(f, 1.1);
    const porNivel = [1.2, 1.15, 1, 0.92, 0.85][nivel] || 1;
    return Math.max(0.4, base * porNivel * (1 - 0.08 * presion));
  }

  // Memoria de lo que hace el jugador (la compu aprende).
  function nuevaMemoria() {
    const cero = () => Object.fromEntries(ZONAS.map(z => [z, 0]));
    return { tiros: cero(), totalTiros: 0, picadas: 0, dives: cero(), totalDives: 0, adelantos: 0 };
  }

  function sortear(pesos, rng) {
    const total = pesos.reduce((s, [, w]) => s + Math.max(0, w), 0);
    let x = rng() * total;
    for (const [k, w] of pesos) { x -= Math.max(0, w); if (x <= 0) return k; }
    return pesos[pesos.length - 1][0];
  }

  // ---- Rivales ----
  const TIPOS_PATEADOR = {
    derecho: { lado: 'D', fuerza: 0.8, precision: 1, picada: 0.03, amague: 0.05, viveza: 0.4, ritmo: 0.3 },
    zurdo: { lado: 'I', fuerza: 0.8, precision: 1, picada: 0.03, amague: 0.05, viveza: 0.4, ritmo: 0.3 },
    potente: { fuerza: 0.98, precision: 1.2, picada: 0, amague: 0, viveza: 0.2, ritmo: 0.22, bajo: true },
    especialista: { fuerza: 0.83, precision: 0.5, esquinas: true, picada: 0.04, amague: 0.08, viveza: 0.7, ritmo: 0.3 },
    nervioso: { fuerza: 0.76, precision: 1.7, picada: 0.02, amague: 0.02, viveza: 0.2, ritmo: 0.28, irregular: true },
    picador: { fuerza: 0.7, precision: 1, picada: 0.3, amague: 0.1, viveza: 0.6, ritmo: 0.4 },
    amagador: { fuerza: 0.8, precision: 1.1, picada: 0.08, amague: 0.55, viveza: 0.8, ritmo: 0.32 }
  };
  const TIPOS_ARQUERO = {
    reflejos: { reflejos: 0.2, lectura: 0, nervios: 0.2 },
    nervioso: { reflejos: 0, lectura: 0, nervios: 0.75 },
    lector: { reflejos: 0, lectura: 0.3, nervios: 0.25 },
    grandote: { reflejos: 0, lectura: 0, nervios: 0.3, grandote: true }
  };
  const NOMBRES = ['Cacho', 'Coco', 'Tito', 'Pocho', 'Lalo', 'Beto', 'Nacho', 'Pato', 'Mono', 'Flaco', 'Gringo',
    'Ruso', 'Chino', 'Tano', 'Pipa', 'Toto', 'Kike', 'Rulo', 'Colo', 'Lucho', 'Facu', 'Juanchi', 'Pela', 'Bocha', 'Cholo', 'Tincho', 'Polaco', 'Manu'];
  const ARQUEROS = ['el Gato', 'el Pulpo', 'el Muro', 'Paredón', 'el Mono', 'el Loco', 'el Pato', 'Manotas', 'el Vasco', 'el Cabezón'];
  const EQUIPOS = ['Social La Loma', 'Atlético Villa Rosa', 'Sportivo Puente Viejo', 'Unión del Sur', 'Juventud Unida',
    'Defensores del Barrio', 'Estrella del Oeste', 'Deportivo La Estación', 'Los Andes del Bajo', 'Fomento Las Acacias'];

  function mezclar(a, rng) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function generarEquipo(nivel = 2, rng = Math.random, nombre) {
    const nombres = mezclar(NOMBRES, rng);
    const tipos = Object.keys(TIPOS_PATEADOR);
    const pateadores = [];
    for (let i = 0; i < 5; i++) {
      const tipo = tipos[Math.floor(rng() * tipos.length)];
      pateadores.push({ nombre: nombres[i], tipo, ...ajustarPateador(TIPOS_PATEADOR[tipo], nivel) });
    }
    const tiposA = Object.keys(TIPOS_ARQUERO);
    const tipoA = tiposA[Math.floor(rng() * tiposA.length)];
    const ta = TIPOS_ARQUERO[tipoA];
    const arquero = {
      nombre: ARQUEROS[Math.floor(rng() * ARQUEROS.length)], tipo: tipoA,
      reflejos: clamp(0.25 + nivel * 0.12 + ta.reflejos, 0, 1),
      lectura: clamp(0.15 + nivel * 0.18 + ta.lectura, 0, 1),
      nervios: ta.nervios, grandote: !!ta.grandote
    };
    return { nombre: nombre || EQUIPOS[Math.floor(rng() * EQUIPOS.length)], nivel, pateadores, arquero };
  }

  function ajustarPateador(p, nivel) {
    return {
      ...p,
      viveza: clamp(p.viveza + (nivel - 2) * 0.15, 0, 1),
      precision: p.precision * (1 - (nivel - 2) * 0.12),
      lectura: clamp(0.15 + nivel * 0.2, 0, 1)
    };
  }

  // Frecuencia suavizada de lo que hizo el jugador.
  function frec(conteo, total, z, lectura) {
    return (lectura * conteo[z] + 1) / (lectura * total + ZONAS.length);
  }

  // La compu elige cómo patear (contra el jugador que ataja).
  function pateadorElige(p, mem, rng = Math.random) {
    const pesos = ZONAS.map(z => {
      let w = { aI: 0.8, aC: 0.35, aD: 0.8, mI: 1, mC: 0.45, mD: 1, bI: 1.2, bC: 0.55, bD: 1.2 }[z];
      if (p.esquinas && col(z) !== 'C') w *= fila(z) === 'm' ? 0.8 : 1.7;
      if (p.bajo) w *= fila(z) === 'b' ? 1.6 : fila(z) === 'a' ? 0.5 : 1;
      if (p.lado && col(z) === p.lado) w *= 2.4;
      // Evita donde el jugador suele tirarse
      let cubierto = 0;
      for (const d of ZONAS) cubierto += frec(mem.dives, mem.totalDives, d, p.lectura) * cobertura(d, z);
      w *= Math.max(0.08, 1 - p.lectura * cubierto * 1.4);
      return [z, w];
    });
    const zona = sortear(pesos, rng);
    const tasaAdelanto = mem.totalDives ? mem.adelantos / mem.totalDives : 0;
    const tasaQuieto = mem.totalDives ? (mem.dives.mC + mem.dives.bC + mem.dives.aC) / mem.totalDives : 0.3;
    let probPicada = p.picada + tasaAdelanto * 0.25 * p.lectura - tasaQuieto * 0.15 * p.lectura;
    const picada = rng() < clamp(probPicada, 0, 0.6);
    const paradinha = !picada && rng() < p.amague;
    const ruido = p.irregular ? 0.18 : 0.08;
    const fuerza = clamp(p.fuerza + (rng() * 2 - 1) * ruido, 0.3, 1.15);
    const ritmo = p.ritmo * (picada ? 1.35 : 1);
    return { zona, picada, paradinha, fuerza, ritmo };
  }

  // Si el jugador se tiró antes de la patada, el pateador vivo cambia.
  function reaccionarAdelanto(p, plan, dive, rng = Math.random) {
    if (rng() >= p.viveza) return plan;
    if (col(dive) !== 'C' && rng() < 0.35) return { ...plan, picada: true, zona: 'mC' };
    const opuesta = col(dive) === 'I' ? 'D' : col(dive) === 'D' ? 'I' : (rng() < 0.5 ? 'I' : 'D');
    const fl = rng() < 0.6 ? 'b' : 'm';
    return { ...plan, picada: false, zona: fl + opuesta };
  }

  // La compu (arquero) elige dónde tirarse contra el tiro del jugador.
  function arqueroElige(a, mem, rng = Math.random) {
    const k = 2 + a.lectura * 6;
    const tasaPicada = mem.totalTiros ? mem.picadas / mem.totalTiros : 0;
    const pesos = ZONAS.map(d => {
      let esperado = 0;
      for (const z of ZONAS) esperado += frec(mem.tiros, mem.totalTiros, z, a.lectura) * cobertura(d, z);
      let w = Math.exp(k * esperado);
      if (d === 'mC') w *= 1 + tasaPicada * 4 * a.lectura;
      return [d, w];
    });
    return sortear(pesos, rng);
  }

  // ---- Tanda ----
  class Tanda {
    constructor(primero = 0) { this.goles = [[], []]; this.primero = primero; }
    cuenta(e) { return this.goles[e].filter(Boolean).length; }
    tiros(e) { return this.goles[e].length; }
    quienPatea() {
      const a = this.tiros(this.primero), b = this.tiros(1 - this.primero);
      return a === b ? this.primero : 1 - this.primero;
    }
    registrar(e, gol) { this.goles[e].push(!!gol); }
    ganador() {
      const a = this.cuenta(0), b = this.cuenta(1), ka = this.tiros(0), kb = this.tiros(1);
      if (ka <= 5 && kb <= 5) {
        if (a + (5 - ka) < b) return 1;
        if (b + (5 - kb) < a) return 0;
        if (ka === 5 && kb === 5 && a !== b) return a > b ? 0 : 1;
        return null;
      }
      if (ka === kb && a !== b) return a > b ? 0 : 1;
      return null;
    }
    terminada() { return this.ganador() !== null; }
    muerteSubita() { return this.tiros(0) >= 5 && this.tiros(1) >= 5; }
    // ¿El próximo penal puede definir la tanda?
    esDecisivo(e) {
      for (const g of [true, false]) {
        const t = new Tanda(this.primero);
        t.goles = [this.goles[0].slice(), this.goles[1].slice()];
        t.registrar(e, g);
        if (t.terminada()) return true;
      }
      return false;
    }
  }

  const API = {
    FILAS, COLS, ZONAS, NOMBRE, fila, col, zonaDeFlechas, ALCANCE, cobertura, probAtajada,
    resolverTiro, duracionVuelo, nuevaMemoria, generarEquipo, pateadorElige, reaccionarAdelanto,
    arqueroElige, Tanda, EQUIPOS, NOMBRES, TIPOS_PATEADOR, mezclar
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.Penales = API;
})(typeof window !== 'undefined' ? window : globalThis);
