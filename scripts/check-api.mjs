#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors

// Checks each listed version's module API against the servers that take it, which
// `wittymodule catalog-check` leaves to the server:
//
//   - its `api` is one a server takes today (MIN_API to MAX_API), so nothing listed is
//     a version no server can install;
//   - a version built for module API 4 or newer that a server installs (helper, program,
//     web) carries sdui.json, which only servers from FIRST_SERVER[api] read, so its
//     minServer is at least that;
//   - which modules have no version for the newest server series, as a note.
//
//   node scripts/check-api.mjs [catalog.json]
//
// The numbers are WittyModule's (manifest.go: API, MinAPI, SDUIFromAPI) and the server's
// (internal/modules/sdui.go). Raise them here in the same change that lists the first
// version of a new API.

import fs from 'node:fs'

const MIN_API = 3
const MAX_API = 4
const SDUI_FROM_API = 4
// The first server each API runs on.
const FIRST_SERVER = { 3: '0.6.0-alpha', 4: '0.8.0-alpha' }
// The newest server series; the note lists modules with no version for it.
const NEWEST_SERVER = '0.8.0-alpha'

const file = process.argv[2] || 'catalog.json'
const catalog = JSON.parse(fs.readFileSync(file, 'utf8'))

/** Compares two versions such as 0.8.0-alpha: numbers first, then a pre-release sorts before none. */
function compare(a, b) {
  const parse = (v) => {
    const [core, pre = ''] = String(v).split('-', 2)
    return { nums: core.split('.').map(Number), pre }
  }
  const x = parse(a), y = parse(b)
  for (let i = 0; i < 3; i++) {
    if ((x.nums[i] || 0) !== (y.nums[i] || 0)) return (x.nums[i] || 0) - (y.nums[i] || 0)
  }
  if (x.pre === y.pre) return 0
  if (!x.pre) return 1
  if (!y.pre) return -1
  return x.pre < y.pre ? -1 : 1
}

/** Whether a server version is at most maxServer, which may be a series such as 0.8.x. */
function atMost(server, max) {
  const m = /^(\d+)\.(\d+)\.x$/.exec(max)
  if (m) {
    const [maj, min] = String(server).split('.').map(Number)
    return maj < +m[1] || (maj === +m[1] && min <= +m[2])
  }
  return compare(server, max) <= 0
}

const problems = []
const noNewest = []
let versions = 0
for (const mod of catalog.modules || []) {
  let fitsNewest = false
  for (const v of mod.versions || []) {
    versions++
    const at = `${mod.id} ${v.version}`
    if (!Number.isInteger(v.api) || v.api < MIN_API || v.api > MAX_API) {
      problems.push(`${at}: module API ${v.api}, and servers take ${MIN_API} to ${MAX_API}`)
      continue
    }
    const installed = ['helper', 'program', 'web'].includes(v.delivery)
    const first = FIRST_SERVER[v.api]
    if (v.api >= SDUI_FROM_API && installed && compare(v.minServer, first) < 0) {
      problems.push(`${at}: built for module API ${v.api}, which carries sdui.json, so minServer must be ${first} or later, not ${v.minServer}`)
    }
    if (!v.withdrawn && compare(NEWEST_SERVER, v.minServer) >= 0 && atMost(NEWEST_SERVER, v.maxServer)) fitsNewest = true
  }
  if ((mod.versions || []).length && !fitsNewest) noNewest.push(mod.id)
}

if (noNewest.length) {
  console.log(`note: no listed version fits server ${NEWEST_SERVER} yet: ${noNewest.join(', ')}`)
}
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`)
  process.exit(1)
}
console.log(`ok ${file}: ${versions} versions, module API ${MIN_API} to ${MAX_API}`)
