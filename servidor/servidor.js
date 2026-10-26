// Servidor de Penales: sirve el juego y las mesas online (uno contra uno, con código).
// Uso: node servidor/servidor.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { aceptar } = require('./ws');
const P = require('../web/logica.js');

const WEB = path.join(__dirname, '..', 'web');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };
const salas = new Map();
const espejo = z => z[0] + ({ I: 'D', D: 'I', C: 'C' })[z[1]];

const servidor = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/salud') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
  let archivo = path.normalize(path.join(WEB, url === '/' ? 'index.html' : url));
  if (!archivo.startsWith(WEB)) { res.writeHead(403); res.end(); return; }
  fs.readFile(archivo, (err, datos) => {
    if (err) { res.writeHead(404); res.end('No está'); return; }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(archivo)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(datos);
  });
});

servidor.on('upgrade', (req, socket) => {
  if (!req.url.startsWith('/ws')) { socket.destroy(); return; }
  const c = aceptar(req, socket);
  if (!c) return;
  c.on('mensaje', m => manejar(c, m));
  c.on('cierre', () => salir(c));
});

function nuevoCodigo() {
  let k;
  do { k = String(1000 + Math.floor(Math.random() * 9000)); } while (salas.has(k));
  return k;
}
const limpiarNombre = n => String(n || '').replace(/[<>]/g, '').trim().slice(0, 20);

function manejar(c, m) {
  if (m.t === 'crear') {
    const codigo = nuevoCodigo();
    const s = { codigo, jugadores: [c, null], nombres: [limpiarNombre(m.nombre) || 'Jugador 1', null], tanda: null, penal: null, revancha: [false, false] };
    salas.set(codigo, s);
    c.sala = s; c.yo = 0;
    c.enviar({ t: 'sala', codigo, yo: 0 });
    return;
  }
  if (m.t === 'unirme') {
    const s = salas.get(String(m.codigo || '').trim());
    if (!s) { c.enviar({ t: 'error', texto: 'No existe una mesa con ese código.' }); return; }
    if (s.jugadores[1]) { c.enviar({ t: 'error', texto: 'Esa mesa ya está completa.' }); return; }
    s.jugadores[1] = c; s.nombres[1] = limpiarNombre(m.nombre) || 'Jugador 2';
    if (s.nombres[1] === s.nombres[0]) s.nombres[1] += ' 2';
    c.sala = s; c.yo = 1;
    c.enviar({ t: 'sala', codigo: s.codigo, yo: 1 });
    empezarTanda(s);
    return;
  }
  const s = c.sala; if (!s || !s.tanda) return;
  const pe = s.penal;
  const otro = s.jugadores[1 - c.yo];
  if (m.t === 'carrera' || m.t === 'paradinha') {
    if (pe && pe.pateador === c.yo && pe.fase === 'esperando') otro && otro.enviar({ t: m.t });
  } else if (m.t === 'dive') {
    // El arquero se tiró antes de la patada: el pateador lo escucha (en su lado).
    if (pe && pe.pateador !== c.yo && pe.fase === 'esperando' && P.ZONAS.includes(m.dive)) otro && otro.enviar({ t: 'dive', dive: espejo(m.dive) });
  } else if (m.t === 'patear') {
    if (!pe || pe.pateador !== c.yo || pe.fase !== 'esperando' || !P.ZONAS.includes(m.zona)) return;
    const fuerza = Math.max(0, Math.min(1.3, Number(m.fuerza) || 0));
    pe.tiro = P.resolverTiro({ zona: m.zona, fuerza, picada: !!m.picada, paradinha: !!m.paradinha, presion: pe.presion, precision: 1 });
    pe.D = P.duracionVuelo(fuerza, !!m.picada, 2, pe.presion);
    pe.fase = 'vuelo';
    const tiroArquero = { ...pe.tiro, zona: espejo(pe.tiro.zona), pedida: espejo(pe.tiro.pedida) };
    c.enviar({ t: 'patada', tiro: pe.tiro, D: pe.D });
    otro && otro.enviar({ t: 'patada', tiro: tiroArquero, D: pe.D, ritmo: m.picada ? 'lento' : fuerza > 0.95 ? 'rapido' : 'normal' });
    pe.limite = setTimeout(() => resolver(s, null, null), (pe.D + 4) * 1000);
  } else if (m.t === 'atajada') {
    if (!pe || pe.pateador === c.yo || pe.fase !== 'vuelo') return;
    resolver(s, P.ZONAS.includes(m.dive) ? m.dive : null, typeof m.rel === 'number' ? m.rel : null);
  } else if (m.t === 'revancha') {
    if (!s.tanda.terminada()) return;
    s.revancha[c.yo] = true;
    otro && otro.enviar({ t: 'pideRevancha' });
    if (s.revancha[0] && s.revancha[1]) empezarTanda(s);
  }
}

function empezarTanda(s) {
  s.tanda = new P.Tanda(Math.random() < 0.5 ? 0 : 1);
  s.revancha = [false, false];
  s.muerteDicha = false;
  for (const j of [0, 1]) s.jugadores[j] && s.jugadores[j].enviar({ t: 'empieza', yo: j, nombres: s.nombres, primero: s.tanda.primero });
  setTimeout(() => siguientePenal(s), 2600);
}

function siguientePenal(s) {
  if (!s.jugadores[0] || !s.jugadores[1] || !s.tanda) return;
  const t = s.tanda;
  if (t.terminada()) {
    for (const j of [0, 1]) s.jugadores[j].enviar({ t: 'fin', ganador: t.ganador(), goles: t.goles });
    return;
  }
  const pateador = t.quienPatea();
  const decisivo = t.esDecisivo(pateador);
  const presion = decisivo ? 1 : Math.min(0.7, (t.tiros(0) + t.tiros(1)) * 0.07);
  let muerte = false;
  if (t.muerteSubita() && !s.muerteDicha) { muerte = true; s.muerteDicha = true; }
  s.penal = { pateador, presion, fase: 'esperando' };
  for (const j of [0, 1]) s.jugadores[j].enviar({ t: 'penal', pateador, decisivo, muerte, presion });
}

function resolver(s, diveArquero, rel) {
  const pe = s.penal;
  if (!pe || pe.fase !== 'vuelo') return;
  clearTimeout(pe.limite);
  pe.fase = 'listo';
  const tiro = pe.tiro;
  const dive = diveArquero ? espejo(diveArquero) : 'mC'; // en el lado del pateador
  const adelantado = diveArquero && rel !== null && rel < 0;
  const tarde = diveArquero && rel !== null ? Math.max(0, rel + P.ALCANCE[dive] - pe.D) : 0;
  let gol = false;
  if (tiro.resultado === 'arco') {
    const p = P.probAtajada({ dive, ball: tiro.zona, fuerza: tiro.fuerza, adelantado, tarde, picada: tiro.picada });
    gol = Math.random() >= p;
  }
  s.tanda.registrar(pe.pateador, gol);
  const base = { t: 'resultado', pateador: pe.pateador, gol, goles: s.tanda.goles, adelantado: !!adelantado, tarde, se: !!diveArquero };
  s.jugadores[pe.pateador] && s.jugadores[pe.pateador].enviar({ ...base, tiro, dive });
  const arq = s.jugadores[1 - pe.pateador];
  arq && arq.enviar({ ...base, tiro: { ...tiro, zona: espejo(tiro.zona) }, dive: espejo(dive) });
  setTimeout(() => siguientePenal(s), 2900);
}

function salir(c) {
  const s = c.sala; if (!s) return;
  s.jugadores[c.yo] = null;
  if (s.penal) clearTimeout(s.penal.limite);
  const otro = s.jugadores[1 - c.yo];
  if (otro) { otro.enviar({ t: 'rivalSeFue' }); otro.sala = null; }
  salas.delete(s.codigo);
}

// Latido para que el servidor gratis no se duerma mientras haya mesas.
setInterval(() => {
  if (salas.size && process.env.RENDER_EXTERNAL_URL) {
    require('https').get(process.env.RENDER_EXTERNAL_URL + '/salud').on('error', () => {});
  }
}, 60000);

const PUERTO = process.env.PORT || 8080;
servidor.listen(PUERTO, () => console.log('Penales en el puerto ' + PUERTO));
