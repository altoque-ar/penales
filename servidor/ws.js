// WebSocket mínimo sin paquetes (solo mensajes de texto).
const crypto = require('crypto');
const { EventEmitter } = require('events');

function aceptar(req, socket) {
  const clave = req.headers['sec-websocket-key'];
  if (!clave) { socket.destroy(); return null; }
  const acepto = crypto.createHash('sha1').update(clave + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acepto + '\r\n\r\n');
  socket.setNoDelay(true);
  const c = new EventEmitter();
  let buf = Buffer.alloc(0), partes = [];
  c.abierto = true;
  c.enviar = obj => {
    if (!c.abierto) return;
    const datos = Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj));
    let cab;
    if (datos.length < 126) cab = Buffer.from([0x81, datos.length]);
    else if (datos.length < 65536) { cab = Buffer.alloc(4); cab[0] = 0x81; cab[1] = 126; cab.writeUInt16BE(datos.length, 2); }
    else { cab = Buffer.alloc(10); cab[0] = 0x81; cab[1] = 127; cab.writeBigUInt64BE(BigInt(datos.length), 2); }
    try { socket.write(Buffer.concat([cab, datos])); } catch (e) { /* cerrado */ }
  };
  c.cerrar = () => { if (!c.abierto) return; c.abierto = false; try { socket.end(Buffer.from([0x88, 0])); } catch (e) {} c.emit('cierre'); };
  socket.on('data', d => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 2) {
      const fin = buf[0] & 0x80, op = buf[0] & 0x0f, mask = buf[1] & 0x80;
      let largo = buf[1] & 0x7f, pos = 2;
      if (largo === 126) { if (buf.length < 4) return; largo = buf.readUInt16BE(2); pos = 4; }
      else if (largo === 127) { if (buf.length < 10) return; largo = Number(buf.readBigUInt64BE(2)); pos = 10; }
      const m = mask ? buf.slice(pos, pos + 4) : null;
      if (mask) pos += 4;
      if (buf.length < pos + largo) return;
      let carga = buf.slice(pos, pos + largo);
      if (m) { carga = Buffer.from(carga); for (let i = 0; i < carga.length; i++) carga[i] ^= m[i & 3]; }
      buf = buf.slice(pos + largo);
      if (op === 0x8) { c.cerrar(); return; }
      if (op === 0x9) { try { socket.write(Buffer.concat([Buffer.from([0x8a, carga.length]), carga])); } catch (e) {} continue; }
      if (op === 0xa) continue;
      partes.push(carga);
      if (fin) {
        const txt = Buffer.concat(partes).toString('utf8'); partes = [];
        try { c.emit('mensaje', JSON.parse(txt)); } catch (e) { /* ignorar */ }
      }
    }
  });
  socket.on('close', () => { if (c.abierto) { c.abierto = false; c.emit('cierre'); } });
  socket.on('error', () => {});
  return c;
}
module.exports = { aceptar };
