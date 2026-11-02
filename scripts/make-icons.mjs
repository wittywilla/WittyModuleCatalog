#!/usr/bin/env node
// Draws every module's icon into icons/<id>.png and records each file's size and SHA-256 in
// catalog.json, so the two can't drift. Needs only Node.
//
//   node scripts/make-icons.mjs           draw the icons and update catalog.json
//   node scripts/make-icons.mjs --check   change nothing; fail if files and catalog.json differ
//
// An icon is a rounded square in its category's colour with one white mark. Marks are made of
// signed-distance shapes: a function of (x, y) that is negative inside and positive outside,
// measured in pixels on the 128-pixel canvas. Each is an original drawing. Never add a brand's,
// console's, disc format's, service's or studio's logo, or anything resembling one.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOG = join(ROOT, 'catalog.json')
const ICONS = join(ROOT, 'icons')
const SIZE = 128
const CORNER = 28
const MAX_ICON = 256 << 10 // the limit in WittyModule's catalog.go

// Top and bottom of each category's gradient. All dark enough for a white mark.
const COLOURS = {
  discs: ['#5B57E8', '#3B2FA8'],
  games: ['#17A34A', '#14622F'],
  tv: ['#E0651E', '#A23A0C'],
  read: ['#0F8C80', '#0B5A55'],
  photos: ['#DD3A82', '#9B1650'],
  listen: ['#A63CD6', '#6A1C96'],
  watch: ['#2F6FEB', '#1C3FA0'],
  tools: ['#1686A6', '#125C75'],
  stats: ['#5E8C14', '#3D5E0D'],
  system: ['#566579', '#28323F'],
}

// ---- Shapes ----

const { abs, atan2, cos, hypot, max, min, PI, sin } = Math

const circle = (cx, cy, r) => (x, y) => hypot(x - cx, y - cy) - r
const ring = (cx, cy, r, w) => (x, y) => abs(hypot(x - cx, y - cy) - r) - w

// A box from its centre and half sizes, with rounded corners.
const box = (cx, cy, hw, hh, r = 0) => (x, y) => {
  const qx = abs(x - cx) - hw + r
  const qy = abs(y - cy) - hh + r
  return hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - r
}

// A line with round ends.
const line = (ax, ay, bx, by, r) => (x, y) => {
  const dx = bx - ax
  const dy = by - ay
  const t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
  return hypot(x - ax - t * dx, y - ay - t * dy) - r
}

// Part of a ring, between two angles in degrees, with round ends.
const arc = (cx, cy, r, w, from, to) => {
  const a = (from * PI) / 180
  const b = (to * PI) / 180
  const ends = [
    [cx + r * cos(a), cy + r * sin(a)],
    [cx + r * cos(b), cy + r * sin(b)],
  ]
  return (x, y) => {
    let t = atan2(y - cy, x - cx)
    if (t < a) t += 2 * PI
    if (t <= b) return abs(hypot(x - cx, y - cy) - r) - w
    return min(hypot(x - ends[0][0], y - ends[0][1]), hypot(x - ends[1][0], y - ends[1][1])) - w
  }
}

// Any polygon, concave too, with its corners rounded by `round`.
const poly = (pts, round = 0) => (x, y) => {
  let d = Infinity
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[i]
    const [bx, by] = pts[j]
    const ex = bx - ax
    const ey = by - ay
    const t = max(0, min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey)))
    d = min(d, hypot(x - ax - t * ex, y - ay - t * ey))
    if (ay > y !== by > y && x < ax + ((y - ay) / (by - ay)) * ex) inside = !inside
  }
  return (inside ? -d : d) - round
}

const union = (...shapes) => (x, y) => {
  let d = Infinity
  for (const s of shapes) d = min(d, s(x, y))
  return d
}
const cut = (shape, ...holes) => (x, y) => {
  let d = shape(x, y)
  for (const h of holes) d = max(d, -h(x, y))
  return d
}
const both = (a, b) => (x, y) => max(a(x, y), b(x, y))
const moved = (shape, dx, dy) => (x, y) => shape(x - dx, y - dy)

// ---- Marks, one per module ----

const DISC = circle(64, 64, 40)

// A burst of `n` points, for a comic's sound effect.
const burst = (cx, cy, outer, inner, n) => {
  const pts = []
  for (let i = 0; i < n * 2; i++) {
    const a = (i * PI) / n - PI / 2
    const r = i % 2 ? inner : outer
    pts.push([cx + r * cos(a), cy + r * sin(a)])
  }
  return poly(pts, 1.5)
}

const MARKS = {
  // The reader under the disc engines: plain concentric rings.
  wittydisc: union(ring(64, 64, 35, 6), ring(64, 64, 18, 5), circle(64, 64, 4.5)),

  // A disc you can play.
  wittydvd: cut(DISC, poly([[52, 44], [52, 84], [86, 64]], 3)),

  // A disc with its hole and a glint, for its bright, high-resolution pictures.
  wittybluray: cut(
    DISC,
    circle(64, 64, 9),
    poly([[81, 34], [84.5, 44.5], [95, 48], [84.5, 51.5], [81, 62], [77.5, 51.5], [67, 48], [77.5, 44.5]], 0.5),
  ),

  // A disc with a music note.
  wittycd: cut(
    DISC,
    circle(57, 80, 10),
    box(64, 60, 3.5, 21, 1),
    poly([[63, 39], [83, 47], [83, 59], [63, 51]], 1),
  ),

  // An open book.
  wittyebook: union(
    poly([[25, 40], [60, 48], [60, 94], [25, 86]], 3),
    poly([[103, 40], [68, 48], [68, 94], [103, 86]], 3),
  ),

  // A page with a turned corner and lines of text.
  wittypdf: cut(
    poly([[41, 27], [70, 27], [90, 47], [90, 101], [41, 101]], 3),
    line(69, 29, 69, 49, 2.2),
    line(69, 49, 90, 49, 2.2),
    line(51, 62, 80, 62, 3.2),
    line(51, 74, 80, 74, 3.2),
    line(51, 86, 68, 86, 3.2),
  ),

  // A comic's burst with an exclamation mark.
  wittycomics: cut(
    burst(64, 64, 49, 32, 11),
    poly([[59, 42], [69, 42], [67, 70], [61, 70]], 1),
    circle(64, 81, 5.5),
  ),

  // A pen nib.
  wittyink: union(
    box(64, 28, 15, 5, 2),
    cut(
      poly([[50, 38], [78, 38], [90, 64], [64, 104], [38, 64]], 2),
      circle(64, 64, 6.5),
      line(64, 66, 64, 106, 1.8),
    ),
  ),

  // A folder.
  wittyintegratedfilebrowser: cut(
    union(box(46, 40, 20, 10, 5), box(64, 68, 42, 30, 7)),
    line(16, 52, 112, 52, 2.2),
  ),

  // A jigsaw-like piece.
  wittymodule: moved(
    cut(
      union(box(58, 70, 28, 28, 5), circle(58, 37, 11), circle(91, 70, 11)),
      circle(30, 70, 9),
      circle(58, 98, 9),
    ),
    -2,
    -2,
  ),

  // Mountains and the sun, in a picture's frame.
  wittyphotos: union(
    cut(box(64, 64, 44, 36, 9), box(64, 64, 36, 28, 4)),
    circle(83, 48, 7),
    both(box(64, 64, 36, 28, 4), poly([[28, 94], [52, 58], [66, 78], [77, 66], [104, 94]])),
  ),

  // A D-pad's cross.
  wittyplay: cut(union(box(64, 64, 15, 42, 6), box(64, 64, 42, 15, 6)), circle(64, 64, 7.5)),

  // A sofa.
  wittycouch: union(
    box(64, 49, 28, 16, 7),
    box(23, 69, 10, 20, 7),
    box(105, 69, 10, 20, 7),
    box(64, 78, 28, 11, 3),
    box(32, 94, 5, 6, 1.5),
    box(96, 94, 5, 6, 1.5),
  ),

  // A source, and what it passes on.
  wittycouchhost: union(
    line(27, 38, 27, 90, 6.5),
    line(49, 38, 73, 64, 6.5),
    line(73, 64, 49, 90, 6.5),
    line(75, 38, 99, 64, 6.5),
    line(99, 64, 75, 90, 6.5),
  ),

  // A graphics card with two fans.
  wittyrigs: union(
    cut(box(71, 58, 38, 25, 5), circle(53, 58, 16), circle(89, 58, 16)),
    circle(53, 58, 6),
    circle(89, 58, 6),
    box(23, 64, 5, 36, 2),
    box(65, 90, 24, 4.5, 1),
  ),

  // A tower with waves.
  wittytuner: moved(
    union(
      line(64, 48, 46, 100, 4.5),
      line(64, 48, 82, 100, 4.5),
      line(54, 80, 74, 80, 4),
      circle(64, 44, 8),
      arc(64, 44, 22, 4.5, -45, 45),
      arc(64, 44, 36, 4.5, -45, 45),
      arc(64, 44, 22, 4.5, 135, 225),
      arc(64, 44, 36, 4.5, 135, 225),
    ),
    0,
    4,
  ),

  // Sound levels around a centre line.
  wittyvisualizer: union(
    line(28, 54, 28, 74, 6),
    line(46, 40, 46, 88, 6),
    line(64, 26, 64, 102, 6),
    line(82, 44, 82, 84, 6),
    line(100, 56, 100, 72, 6),
  ),

  // A bar chart on its baseline.
  wittystats: union(
    box(36, 76, 9, 18, 2),
    box(64, 60, 9, 34, 2),
    box(92, 46, 9, 48, 2),
    box(64, 101, 41, 3.5, 1.5),
  ),
}

// ---- Drawing ----

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const clamp01 = (v) => max(0, min(1, v))

// Covers a pixel by how far inside the shape its centre is, which is the anti-aliasing.
const coverage = (d) => clamp01(0.5 - d)

function draw(mark, [top, bottom]) {
  const from = rgb(top)
  const to = rgb(bottom)
  const back = box(SIZE / 2, SIZE / 2, SIZE / 2, SIZE / 2, CORNER)
  const out = new Uint8Array(SIZE * SIZE * 4)
  for (let row = 0; row < SIZE; row++) {
    const t = row / (SIZE - 1)
    for (let col = 0; col < SIZE; col++) {
      const x = col + 0.5
      const y = row + 0.5
      const alpha = coverage(back(x, y))
      const at = (row * SIZE + col) * 4
      if (alpha === 0) continue // fully transparent stays all zeros
      // A soft shadow under the mark lifts it off the colour at small sizes.
      const shadow = 0.22 * clamp01(0.5 - mark(x, y - 2) / 3)
      const white = coverage(mark(x, y))
      for (let c = 0; c < 3; c++) {
        const base = (from[c] + (to[c] - from[c]) * t) * (1 - shadow)
        out[at + c] = Math.round(base + (255 - base) * white)
      }
      out[at + 3] = Math.round(alpha * 255)
    }
  }
  return out
}

// ---- PNG ----

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const head = Buffer.alloc(4)
  head.writeUInt32BE(data.length)
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc32(body))
  return Buffer.concat([head, body, tail])
}

function png(rgba) {
  const stride = SIZE * 4
  const raw = Buffer.alloc((stride + 1) * SIZE)
  for (let row = 0; row < SIZE; row++) {
    const at = row * (stride + 1)
    raw[at] = 2 // PNG's "up" filter suits a vertical gradient
    for (let i = 0; i < stride; i++) {
      const above = row ? rgba[(row - 1) * stride + i] : 0
      raw[at + 1 + i] = (rgba[row * stride + i] - above) & 255
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(SIZE, 0)
  header.writeUInt32BE(SIZE, 4)
  header[8] = 8 // bits per channel
  header[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---- The catalogue ----

const fileEntry = (id, bytes) => ({
  url: `${id}.png`,
  size: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
})

// The icon sits after the description, where WittyModule writes it, so that a catalogue written
// by the release tool and one written here differ only in what really changed.
function withIcon(mod, icon) {
  const out = {}
  for (const [key, value] of Object.entries(mod)) {
    if (key === 'icon') continue
    if (key === 'publisher') out.icon = icon
    out[key] = value
  }
  return out
}

function check(catalog) {
  const problems = []
  for (const mod of catalog.modules) {
    const file = join(ICONS, `${mod.id}.png`)
    if (!existsSync(file)) {
      problems.push(`${mod.id}: no icon at icons/${mod.id}.png`)
      continue
    }
    const want = JSON.stringify(fileEntry(mod.id, readFileSync(file)))
    if (JSON.stringify(mod.icon) !== want) problems.push(`${mod.id}: catalog.json doesn't match its icon`)
    if (readFileSync(file).length > MAX_ICON) problems.push(`${mod.id}: icon over ${MAX_ICON} bytes`)
  }
  const known = new Set(catalog.modules.map((m) => `${m.id}.png`))
  for (const name of readdirSync(ICONS)) {
    if (name.endsWith('.png') && !known.has(name)) problems.push(`icons/${name} belongs to no listed module`)
  }
  return problems
}

const raw = readFileSync(CATALOG, 'utf8')
const catalog = JSON.parse(raw)

if (process.argv.includes('--check')) {
  const problems = check(catalog)
  for (const p of problems) console.error(p)
  if (problems.length) {
    console.error('Run: node scripts/make-icons.mjs')
    process.exit(1)
  }
  console.log(`${catalog.modules.length} icons match catalog.json`)
  process.exit(0)
}

catalog.modules = catalog.modules.map((mod) => {
  const mark = MARKS[mod.id]
  const colours = COLOURS[mod.group]
  if (!mark) throw new Error(`${mod.id} has no mark: add one to MARKS`)
  if (!colours) throw new Error(`${mod.id}: "${mod.group}" isn't a category with a colour`)
  const bytes = png(draw(mark, colours))
  writeFileSync(join(ICONS, `${mod.id}.png`), bytes)
  return withIcon(mod, fileEntry(mod.id, bytes))
})

const written = `${JSON.stringify(catalog, null, 2)}\n`
if (written !== raw) {
  writeFileSync(CATALOG, written)
  console.log('catalog.json updated. If an icon changed, raise its serial too.')
}
console.log(`${catalog.modules.length} icons drawn`)
