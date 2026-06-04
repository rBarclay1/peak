// Generates placeholder PWA icons (dark bg + crimson peak) as PNGs.
// Pure Node (zlib), no dependencies. Run: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const BG = [0x0a, 0x0a, 0x0a]
const ACCENT = [0xc0, 0x39, 0x2b]

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function makePng(size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type RGB
  // 10,11,12 = 0 (deflate, no filter, no interlace)

  // raw pixels with a per-row filter byte (0 = none)
  const raw = Buffer.alloc(size * (size * 3 + 1))
  let p = 0
  for (let y = 0; y < size; y++) {
    raw[p++] = 0 // filter
    for (let x = 0; x < size; x++) {
      // mountain peak: triangle pointing up, centered
      const cx = size / 2
      const baseY = size * 0.78
      const peakY = size * 0.24
      const halfW = (baseY - y) * ((size * 0.34) / (baseY - peakY))
      const inPeak = y >= peakY && y <= baseY && Math.abs(x - cx) <= halfW
      const [r, g, b] = inPeak ? ACCENT : BG
      raw[p++] = r
      raw[p++] = g
      raw[p++] = b
    }
  }

  const idat = deflateSync(raw)
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), makePng(size))
  console.log(`wrote icon-${size}.png`)
}
