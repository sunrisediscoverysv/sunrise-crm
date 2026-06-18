// Toma el favicon (logo blanco) de Sunrise y lo recolorea sobre fondo naranja
// para los íconos PWA. Sin dependencias externas (decodifica/codifica PNG con zlib).
import zlib from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = process.argv[2] || '/tmp/sunrise-fav.png'
const ORANGE = [0xf4, 0x7c, 0x20] // #f47c20 — naranja amanecer

// ── Decodificar PNG (color type 6, 8-bit) ──
function decode(buf) {
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20)
  let p = 8, idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const type = buf.toString('ascii', p + 4, p + 8)
    if (type === 'IDAT') idat.push(buf.subarray(p + 8, p + 8 + len))
    p += 12 + len
    if (type === 'IEND') break
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const bpp = 4, stride = w * bpp
  const out = Buffer.alloc(h * stride)
  let pos = 0
  const paeth = (a, b, c) => {
    const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < h; y++) {
    const ft = raw[pos++]
    for (let x = 0; x < stride; x++) {
      const v = raw[pos++]
      const a = x >= bpp ? out[y * stride + x - bpp] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0
      let r
      switch (ft) {
        case 0: r = v; break
        case 1: r = v + a; break
        case 2: r = v + b; break
        case 3: r = v + ((a + b) >> 1); break
        case 4: r = v + paeth(a, b, c); break
        default: r = v
      }
      out[y * stride + x] = r & 0xff
    }
  }
  return { w, h, px: out }
}

// ── Codificar PNG (RGBA opaco) ──
const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c } return t })()
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function encode(w, h, px) {
  const stride = w * 4
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride) }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Recolorear: componer el logo sobre fondo naranja ──
const { w, h, px } = decode(readFileSync(SRC))
const out = Buffer.alloc(px.length)
for (let i = 0; i < px.length; i += 4) {
  const a = px[i + 3] / 255
  // logo (px[i..]) sobre naranja, resultado opaco
  out[i]     = Math.round(ORANGE[0] * (1 - a) + px[i]     * a)
  out[i + 1] = Math.round(ORANGE[1] * (1 - a) + px[i + 1] * a)
  out[i + 2] = Math.round(ORANGE[2] * (1 - a) + px[i + 2] * a)
  out[i + 3] = 255
}
writeFileSync(new URL('../public/icon-512.png', import.meta.url), encode(w, h, out))
console.log(`icon-512.png recoloreado (${w}x${h}) sobre #f47c20`)
