// Dos jugadores automáticos juegan online contra el servidor local.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const dormir = ms => new Promise(r => setTimeout(r, ms));
const FL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const azar = a => a[Math.floor(Math.random() * a.length)];

(async () => {
  const srv = spawn('node', [path.join(__dirname, '../servidor/servidor.js')], { env: { ...process.env, PORT: '8131' } });
  await dormir(600);
  const browser = await chromium.launch();
  const errores = [];
  const pags = [];
  const avisos = [[], []];
  for (let i = 0; i < 2; i++) {
    const p = await browser.newPage();
    p.on('pageerror', e => errores.push(i + ': ' + e.message));
    await p.exposeFunction('__aviso', t => avisos[i].push(t));
    await p.goto('http://localhost:8131/?prueba=4');
    await p.evaluate(() => { for (const id of ['aviso1', 'aviso2']) new MutationObserver(() => { const t = document.getElementById(id).textContent; if (t) window.__aviso(t); }).observe(document.getElementById(id), { childList: true, characterData: true, subtree: true }); });
    pags.push(p);
  }
  const [a, b] = pags;
  await a.click('#bOnline'); await a.fill('#oNombre', 'Fer'); await a.click('#oCrear');
  await dormir(500);
  const estado = await a.textContent('#oEstado');
  const codigo = estado.replace(/\D/g, '');
  console.log('A:', estado);
  await b.click('#bOnline'); await b.fill('#oNombre', 'Alexis'); await b.fill('#oCodigo', codigo); await b.click('#oUnirme');

  let revanchas = 0, finales = [];
  const t0 = Date.now();
  async function turno(p) {
    const e = await p.evaluate(() => { const J = window.__penales; return { pant: document.body.dataset.pantalla, pat: J.patear && J.patear.fase, at: J.atajar && J.atajar.fase, dive: J.atajar && J.atajar.dive }; });
    if (e.pant === 'fin') return 'fin';
    if (e.pat === 'listo') {
      const fl = Math.random() < 0.3 ? [] : [azar(FL)];
      for (const k of fl) await p.keyboard.down(k);
      await p.keyboard.down('Space'); await dormir(80 + Math.random() * 200);
      if (Math.random() < 0.15) { await p.keyboard.press('KeyA'); await dormir(100); }
      if (Math.random() < 0.1) await p.keyboard.press('KeyP'); else await p.keyboard.up('Space');
      await p.keyboard.up('Space').catch(() => {});
      for (const k of fl) await p.keyboard.up(k);
    } else if ((e.at === 'carrera' || e.at === 'vuelo') && !e.dive && Math.random() < 0.08) {
      const k = azar(FL); await p.keyboard.down(k); await dormir(10); await p.keyboard.up(k);
    }
  }
  while (Date.now() - t0 < 240000) {
    const r = [await turno(a), await turno(b)];
    if (r[0] === 'fin' && r[1] === 'fin') {
      finales.push(await a.textContent('#finTexto') + ' | ' + await b.textContent('#finTexto'));
      if (revanchas++ >= 1) break;
      await a.click('#finSeguir'); await dormir(300); await b.click('#finSeguir');
      await dormir(800);
    }
    await dormir(15);
  }
  console.log('Finales:', finales);
  console.log('Avisos A:', avisos[0].slice(0, 14));
  console.log('Avisos B:', avisos[1].slice(0, 14));
  // Uno se va
  await b.close();
  await dormir(500);
  console.log('A al irse B:', await a.textContent('#finTexto'));
  await browser.close(); srv.kill();
  if (errores.length) { console.log('ERRORES', errores); process.exit(1); }
  if (finales.length < 2) { console.log('No terminaron 2 partidas'); process.exit(1); }
  console.log('Online OK');
})().catch(e => { console.error(e); process.exit(1); });
