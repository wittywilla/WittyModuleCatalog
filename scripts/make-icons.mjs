#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// WittyModuleCatalog - The signed list of modules a WittyMediaServer can install.
// Copyright (C) 2026 WittyWilla and contributors
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

// Records every module's icon in catalog.json: each file's size and SHA-256, so the two can't
// drift. The icons themselves are drawn by WittyMediaServer's genicon, the one generator for the
// whole family's logos and icons, through scripts/sync-brand.sh (which runs this afterwards).
//
//   node scripts/make-icons.mjs           update catalog.json from icons/
//   node scripts/make-icons.mjs --check   change nothing; fail if files and catalog.json differ
//
// A module's mark lives in WittyMediaServer's internal/brandart/modules.go. Each is an original
// drawing: never add a brand's, console's, disc format's, service's or studio's logo, or
// anything resembling one.
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOG = join(ROOT, 'catalog.json')
const ICONS = join(ROOT, 'icons')
const MAX_ICON = 256 << 10 // the limit in WittyModule's catalog.go

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
    console.error('Run: scripts/sync-brand.sh')
    process.exit(1)
  }
  console.log(`${catalog.modules.length} icons match catalog.json`)
  process.exit(0)
}

catalog.modules = catalog.modules.map((mod) => {
  const file = join(ICONS, `${mod.id}.png`)
  if (!existsSync(file)) throw new Error(`${mod.id} has no icon: add its mark to genicon and run scripts/sync-brand.sh`)
  const bytes = readFileSync(file)
  if (bytes.length > MAX_ICON) throw new Error(`${mod.id}: icon over ${MAX_ICON} bytes`)
  return withIcon(mod, fileEntry(mod.id, bytes))
})

const written = `${JSON.stringify(catalog, null, 2)}\n`
if (written !== raw) {
  writeFileSync(CATALOG, written)
  console.log('catalog.json updated. If an icon changed, raise its serial too.')
}
console.log(`${catalog.modules.length} icons recorded`)
