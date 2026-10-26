const assert = require('assert');
const P = require('../src/logica.js');
let ok = 0;
function prueba(nombre, fn) { fn(); ok++; console.log('OK', nombre); }

prueba('flechas a zonas (como pidió Fer)', () => {
  const z = f => P.zonaDeFlechas(f);
  assert.strictEqual(z({}), 'mC');
  assert.strictEqual(z({ arriba: true }), 'aC');
  assert.strictEqual(z({ der: true }), 'mD');
  assert.strictEqual(z({ izq: true }), 'mI');
  assert.strictEqual(z({ arriba: true, der: true }), 'aD');
  assert.strictEqual(z({ arriba: true, izq: true }), 'aI');
  assert.strictEqual(z({ abajo: true, der: true }), 'bD');
  assert.strictEqual(z({ abajo: true }), 'bC');
});

prueba('quieto cubre medio y abajo al centro', () => {
  assert(P.cobertura('mC', 'mC') > 0.9 && P.cobertura('mC', 'bC') > 0.9);
  assert.strictEqual(P.cobertura('mD', 'mI'), 0);
  assert(P.cobertura('aD', 'aD') > 0.5);
});

prueba('picada: gol si te tirás, atajada si te quedás', () => {
  assert.strictEqual(P.probAtajada({ dive: 'mD', ball: 'mC', fuerza: 0.5, picada: true }), 0);
  assert(P.probAtajada({ dive: 'mC', ball: 'mC', fuerza: 0.5, picada: true }) > 0.8);
});

prueba('llegar tarde no ataja', () => {
  assert.strictEqual(P.probAtajada({ dive: 'aD', ball: 'aD', fuerza: 0.8, tarde: 0.2 }), 0);
  assert(P.probAtajada({ dive: 'aD', ball: 'aD', fuerza: 0.8, tarde: 0 }) > 0.4);
});

prueba('pasarse de fuerza arriba se va por arriba seguido', () => {
  let afuera = 0;
  for (let i = 0; i < 2000; i++) if (P.resolverTiro({ zona: 'aD', fuerza: 1.25 }).resultado !== 'arco') afuera++;
  assert(afuera > 1000, afuera);
  let bien = 0;
  for (let i = 0; i < 2000; i++) if (P.resolverTiro({ zona: 'aD', fuerza: 0.82 }).resultado === 'arco') bien++;
  assert(bien > 1650, bien);
});

prueba('tanda: termina antes si no se puede alcanzar', () => {
  const t = new P.Tanda(0);
  for (let i = 0; i < 3; i++) { t.registrar(0, true); t.registrar(1, false); }
  assert.strictEqual(t.ganador(), 0);
});

prueba('tanda: muerte súbita', () => {
  const t = new P.Tanda(0);
  for (let i = 0; i < 5; i++) { t.registrar(0, true); t.registrar(1, true); }
  assert.strictEqual(t.ganador(), null);
  assert(t.muerteSubita());
  assert(t.esDecisivo(t.quienPatea()) === false);
  t.registrar(0, false);
  assert(t.esDecisivo(1));
  t.registrar(1, true);
  assert.strictEqual(t.ganador(), 1);
});

prueba('tanda simulada siempre termina', () => {
  for (let n = 0; n < 500; n++) {
    const t = new P.Tanda(n % 2);
    let g = 0;
    while (!t.terminada() && g++ < 200) t.registrar(t.quienPatea(), Math.random() < 0.75);
    assert(t.terminada());
  }
});

prueba('el arquero de la compu aprende', () => {
  const mem = P.nuevaMemoria();
  for (let i = 0; i < 12; i++) { mem.tiros.bD++; mem.totalTiros++; }
  const arq = { lectura: 0.9 };
  let ahi = 0;
  for (let i = 0; i < 2000; i++) { const d = P.arqueroElige(arq, mem); if (P.col(d) === 'D') ahi++; }
  assert(ahi > 1300, ahi);
});

prueba('el pateador de la compu evita donde te tirás', () => {
  const mem = P.nuevaMemoria();
  for (let i = 0; i < 12; i++) { mem.dives.mD++; mem.totalDives++; }
  const p = { ...P.TIPOS_PATEADOR.derecho, lectura: 0.9, viveza: 0.5 };
  let derecha = 0;
  for (let i = 0; i < 2000; i++) { const pl = P.pateadorElige(p, mem); if (!pl.picada && P.col(pl.zona) === 'D') derecha++; }
  const sin = P.nuevaMemoria();
  let derecha2 = 0;
  for (let i = 0; i < 2000; i++) { const pl = P.pateadorElige(p, sin); if (!pl.picada && P.col(pl.zona) === 'D') derecha2++; }
  assert(derecha < derecha2 * 0.8, derecha + ' vs ' + derecha2);
});

prueba('equipos con 5 pateadores y arquero', () => {
  for (let n = 1; n <= 4; n++) {
    const e = P.generarEquipo(n);
    assert.strictEqual(e.pateadores.length, 5);
    assert(e.arquero.nombre && e.nombre);
  }
});

console.log(ok + ' pruebas OK');
