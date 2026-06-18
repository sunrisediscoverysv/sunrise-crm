// Genera el ícono PWA de Sunrise (amanecer) como PNG, sin dependencias externas.
import zlib from 'node:zlib'
import { writeFileSync } from 'node:fs'

const SIZE = 512
const DARK = [17, 66, 82]      // #114252 fondo
const TEAL = [3, 165, 175]     // #03a5af sol
const GOLD = [238, 187, 105]   // #eebb69 rayos / borde

function lerp(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)) }

function px(x, y) {
  const cx = SIZE / 2
  const cy = SIZE * 0.60          // sol un poco bajo (amanecer)
  const dx = x - cx
  const dy = y - cy
  const dist = Math.sqrt(dx * dx + dy * dy)
  const horizon = SIZE * 0.72

  // Rayos dorados (sectores) detrás del sol, sobre el horizonte
  if (y < horizon) {
    const ang = Math.atan2(dy, dx)
    const ray = Math.abs(Math.sin(ang * 6))
    if (dist > 150 && dist < 240 && ray > 0.82) {
      const fade = 1 - (dist - 150) / 90
      return lerp(DARK, GOLD, Math.max(0, fade) * 0.85)
    }
  }
  // Sol
  if (dist < 150) {
    const t = dist / 150
    return lerp(TEAL, lerp(TEAL, GOLD, 0.35), t)
  }
  // Borde dorado del sol
  if (dist < 162) return GOLD
  // Línea de horizonte
  if (Math.abs(y - horizon) < 6) return lerp(DARK, GOLD, 0.5)
  return DARK
}

function buildPNG(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  let o = 0
  for (let y = 0; y < size; y++) {
    raw[o++] = 0 // filter type none
    for (let x = 0; x < size; x++) {
      const sx = (x / size) * SIZE
      const sy = (y / size) * SIZE
      const [r, g, b] = px(sx, sy)
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = 255
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 })

  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
    const t = Buffer.from(type, 'ascii')
    const body = Buffer.concat([t, data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0, 0)
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

const crcTable = (() => {
  const t = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return c ^ 0xffffffff
}

writeFileSync(new URL('../public/icon-512.png', import.meta.url), buildPNG(512))
writeFileSync(new URL('../public/icon-192.png', import.meta.url), buildPNG(192))
console.log('Iconos generados: public/icon-512.png, public/icon-192.png')
