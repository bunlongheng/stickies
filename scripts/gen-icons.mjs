#!/usr/bin/env node
/**
 * Generates PWA icons for Stickies.
 * Creates a yellow sticky note icon with a folded corner.
 * Pure Node.js, no extra deps.
 */
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'icons', 'stickies')
mkdirSync(OUT, { recursive: true })

// CRC32 table
const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[i] = c
}
function crc32(buf) {
  let crc = 0xffffffff
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const td = Buffer.concat([t, data])
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td), 0)
  return Buffer.concat([len, td, cr])
}

function makePNG(size) {
  const fold = Math.round(size * 0.22)   // folded corner size
  const pad  = Math.round(size * 0.18)   // text line padding
  const lh   = Math.round(size * 0.07)   // line height
  const lw   = Math.round(size * 0.55)   // line width

  // Colours (RGB)
  const BG   = [0xFF, 0xCC, 0x00]  // #FFCC00 yellow
  const FOLD = [0xE5, 0xB8, 0x00]  // #E5B800 darker fold
  const LINE = [0xB8, 0x96, 0x00]  // #B89600 text line
  const SHAD = [0xCC, 0xA8, 0x00]  // fold shadow edge

  const raw = Buffer.alloc(size * (1 + size * 3))
  let pos = 0

  for (let y = 0; y < size; y++) {
    raw[pos++] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      const fromRight = size - 1 - x
      const fromTop   = y

      let px
      if (fromRight < fold && fromTop < fold) {
        // folded corner triangle
        if (fromRight + fromTop < fold) {
          // above the fold diagonal → transparent-ish: use fold color
          px = FOLD
        } else {
          px = BG
        }
      } else if (fromRight === fold && fromTop < fold) {
        px = SHAD  // shadow edge of fold
      } else {
        // text lines
        const inLine = (row) => {
          const ly = pad + row * (lh + Math.round(size * 0.05))
          return y >= ly && y < ly + lh && x >= pad && x < pad + lw - (row === 0 ? Math.round(size * 0.12) : 0)
        }
        if (inLine(0) || inLine(1) || inLine(2) || inLine(3)) {
          px = LINE
        } else {
          px = BG
        }
      }
      raw[pos++] = px[0]
      raw[pos++] = px[1]
      raw[pos++] = px[2]
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.writeUInt8(8, 8)  // bit depth
  ihdr.writeUInt8(2, 9)  // color type: RGB

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),  // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) {
  const buf = makePNG(size)
  const file = join(OUT, `icon-${size}.png`)
  writeFileSync(file, buf)
  console.log(`✓ ${file} (${buf.length} bytes)`)
}

// Also write android-chrome-192x192.png (legacy reference in page.tsx)
writeFileSync(join(OUT, 'android-chrome-192x192.png'), makePNG(192))
console.log(`✓ android-chrome-192x192.png`)
