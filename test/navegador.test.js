// Juega partidas completas en el navegador con un jugador automático.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../Penales.html') + '?prueba=20';
const FL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const azar = a => a[Math.floor(Math.random() * a.length)];
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function bot(page, maxMs, alFin) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const e = await page.evaluate(() => {
      const J = window.__penales;
      return { pant: document.body.dataset.pantalla, patear: J.patear && J.patear.fase, atajar: J.atajar && J.atajar.fase, dive: J.atajar && J.atajar.dive };
    });
    if (e.pant === 'fin') { const r = await alFin(); if (r === 'listo') return; continue; }
    if (e.patear === 'listo') {
      const fl = Math.random() < 0.3 ? [] : [azar(FL)].concat(Math.random() < 0.4 ? [azar(FL)] : []);
      for (const k of fl) await page.keyboard.down(k);
      await page.keyboard.down('Space');
      await dormir(15 + Math.random() * 60);
      const x = Math.random();
      if (x < 0.1) await page.keyboard.press('KeyP');
      else if (x < 0.2) { await page.keyboard.press('KeyA'); await dormir(30); }
      await page.keyboard.up('Space');
      for (const k of fl) await page.keyboard.up(k);
    } else if ((e.atajar === 'carrera' || e.atajar === 'vuelo') && !e.dive && Math.random() < 0.3) {
      const fl = [azar(FL)].concat(Math.random() < 0.4 ? [azar(FL)] : []);
      for (const k of fl) await page.keyboard.down(k);
      await dormir(8);
      for (const k of fl) await page.keyboard.up(k);
      await dormir(30);
    }
    await dormir(5);
  }
  throw new Error('No terminó a tiempo');
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  const avisos = [];
  await page.exposeFunction('__aviso', t => avisos.push(t));
  await page.goto(URL);
  await page.evaluate(() => {
    for (const id of ['aviso1', 'aviso2']) new MutationObserver(() => { const t = document.getElementById(id).textContent; if (t) window.__aviso(t); }).observe(document.getElementById(id), { childList: true, characterData: true, subtree: true });
  });

  // 1) Tres tandas
  let resultados = [];
  for (let i = 0; i < 3; i++) {
    await page.click('#bTanda');
    await bot(page, 120000, async () => { resultados.push(await page.textContent('#finTexto')); await page.click('#finMenu'); return 'listo'; });
  }
  console.log('Tandas:', resultados);

  // 2) Copa completa (seguir mientras pase de ronda)
  await page.click('#bCopa');
  let copa = [];
  await bot(page, 400000, async () => {
    const t = await page.textContent('#finTexto'); copa.push(t);
    const b = await page.textContent('#finSeguir');
    if (b === 'Seguir') { await page.click('#finSeguir'); return 'sigue'; }
    await page.click('#finMenu'); return 'listo';
  });
  console.log('Copa:', copa);

  // 3) Pausa y seguir en medio de una tanda
  await page.click('#bTanda');
  await dormir(400);
  await page.keyboard.press('Escape');
  const pant = await page.evaluate(() => document.body.dataset.pantalla);
  if (pant !== 'pausa') throw new Error('No pausó: ' + pant);
  await page.keyboard.press('Escape');
  await dormir(50);
  const pant2 = await page.evaluate(() => document.body.dataset.pantalla);
  if (pant2 !== 'juego') throw new Error('No siguió: ' + pant2);
  await bot(page, 120000, async () => { await page.click('#finMenu'); return 'listo'; });
  console.log('Pausa y seguir: OK');

  // 4) Prácticas
  for (const b of ['#bPracPatear', '#bPracAtajar']) {
    await page.click(b);
    const antes = avisos.length;
    const t0 = Date.now();
    while (Date.now() - t0 < 6000) {
      const e = await page.evaluate(() => window.__penales.patear && window.__penales.patear.fase);
      if (e === 'listo') { await page.keyboard.down('ArrowRight'); await page.keyboard.down('Space'); await dormir(55); await page.keyboard.up('Space'); await page.keyboard.up('ArrowRight'); }
      await dormir(10);
    }
    const tot = await page.evaluate(() => window.__penales.practica.total);
    if (tot < 3) throw new Error('Práctica no avanzó ' + b);
    await page.keyboard.press('Escape'); await page.click('#pMenu');
    console.log('Práctica', b, tot, 'penales. Ej:', avisos.slice(antes).filter(a => /Fuerza|Te tiraste|Te quedaste/.test(a)).slice(0, 2));
  }
  console.log('Avisos de ejemplo:', [...new Set(avisos)].slice(0, 25));
  if (errores.length) { console.log('ERRORES:', errores); process.exit(1); }
  console.log('Sin errores. Avisos totales:', avisos.length);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
