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
//   - a version built for module API 5 or newer that a server installs carries
//     integration.json, and its entry has the `integration` summary `wittymodule catalog-add`
//     writes from it, within the limits a server holds it to: the store's "What this adds";
//   - its `status`, when it has one, is stable, beta, experimental or incomplete, and an
//     experimental or incomplete version says why in `statusNote`: one line of plain text of
//     at most 500 characters, which the store shows before anyone installs it;
//   - as notes: which modules have no version for the newest server series, which have no
//     version for the newest module API yet (they need a new release), and which API-4-or-newer
//     versions have no `ui` summary of their sdui.json.
//
//   node scripts/check-api.mjs [catalog.json]
//
// The numbers are WittyModule's (manifest.go: API, MinAPI, SDUIFromAPI; integration.go:
// IntegrationFromAPI; catalog.go: the summary's limits) and the server's
// (internal/modules/sdui.go). Raise them here in the same change that lists the first version
// of a new API.

import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

export const MIN_API = 3
export const MAX_API = 5
export const SDUI_FROM_API = 4
export const INTEGRATION_FROM_API = 5
// The first server each API runs on.
export const FIRST_SERVER = { 3: '0.6.0-alpha', 4: '0.8.0-alpha', 5: '0.8.0-alpha' }
// The newest server series; the note lists modules with no version for it.
export const NEWEST_SERVER = '0.8.0-alpha'
// A version's status (WittyModule manifest.go: Status*, MaxStatusNote).
const STATUSES = ['stable', 'beta', 'experimental', 'incomplete']
const NEEDS_NOTE = ['experimental', 'incomplete']
const MAX_STATUS_NOTE = 500
// What an integration summary may hold (WittyModule IntegrationSummary and its check in
// catalog.go). `scans` is the kinds of library a version scans, from WittyModule 0.5.3.
const INTEGRATION_FIELDS = ['routes', 'screens', 'settings', 'data', 'feature', 'scans']
const MAX_ROUTES = 1000
const MAX_SCREENS = 64
const MAX_SETTINGS = 32
const MAX_TEXT = 2000
const INSTALLED = ['helper', 'program', 'web']

/** Compares two versions such as 0.8.0-alpha: numbers first, then a pre-release sorts before none. */
export function compare(a, b) {
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

/** One line of plain text: no control characters, at most `limit` bytes as WittyModule counts them. */
const plainLine = (s, limit = MAX_TEXT) => typeof s === 'string' && Buffer.byteLength(s) <= limit && !/[\u0000-\u001f\u007f]/.test(s)

/** What is wrong with a version's status and note, as WittyModule checks them; [] when nothing. */
function statusProblems(status, note) {
  const out = []
  if (status !== undefined && !STATUSES.includes(status)) {
    out.push(`status ${JSON.stringify(status)} isn't one of ${STATUSES.join(', ')}`)
  }
  if (note !== undefined && typeof note !== 'string') {
    out.push('statusNote is text')
  } else if (note !== undefined && (Array.from(note).length > MAX_STATUS_NOTE || /[\u0000-\u001f\u007f]/.test(note))) {
    out.push(`statusNote is one line of plain text of at most ${MAX_STATUS_NOTE} characters, with no control characters`)
  } else if (NEEDS_NOTE.includes(status) && !(note || '').trim()) {
    out.push(`a version that is ${status} says what isn't done or may break, in statusNote`)
  }
  return out
}

/**
 * What is wrong with a version's integration summary; [] when nothing. It says what the version
 * adds to a server: how many routes, the web app's screens (addresses starting with /), its
 * sections in Settings by label, whether it keeps a database, the profile feature it belongs
 * to, and the kinds of library it scans.
 */
export function integrationProblems(s) {
  if (s === null || typeof s !== 'object' || Array.isArray(s)) return ['integration is an object, the summary catalog-add writes']
  const out = []
  for (const k of Object.keys(s)) {
    if (!INTEGRATION_FIELDS.includes(k)) out.push(`integration has ${JSON.stringify(k)}, which isn't one of ${INTEGRATION_FIELDS.join(', ')}`)
  }
  if (s.routes !== undefined && (!Number.isInteger(s.routes) || s.routes < 0 || s.routes > MAX_ROUTES)) {
    out.push(`integration.routes is a count from 0 to ${MAX_ROUTES}`)
  }
  const list = (name, max, each, what) => {
    const v = s[name]
    if (v === undefined) return
    if (!Array.isArray(v) || v.length > max) {
      out.push(`integration.${name} is a list of at most ${max}`)
      return
    }
    v.forEach((x, i) => {
      if (!plainLine(x) || !x.trim() || !each(x)) out.push(`integration.${name}[${i}] isn't ${what}`)
    })
  }
  list('screens', MAX_SCREENS, (x) => x.startsWith('/'), 'an address in the web app, starting with /')
  list('settings', MAX_SETTINGS, () => true, 'a label: one line of plain text')
  list('scans', MAX_SETTINGS, (x) => /^[a-z][a-z0-9-]{0,63}$/.test(x), 'a kind of library')
  if (s.data !== undefined && typeof s.data !== 'boolean') out.push('integration.data is true or false')
  if (s.feature !== undefined && !(plainLine(s.feature) && /^[a-z][a-z0-9-]*$/.test(s.feature))) {
    out.push('integration.feature is a feature\'s name, such as games')
  }
  return out
}

/**
 * Whether a server version is at most maxServer, which may be a series such as 0.8.x. As a
 * server reads it (internal/modules/widen.go), a pre-1.0 series such as 0.6.x stands for any
 * 0.x server: before 1.0 the module API number decides what fits, not the minor version.
 */
function atMost(server, max) {
  if (/^0\.\d+\.x$/.test(max)) max = '0.x'
  if (max === '0.x') return String(server).startsWith('0.')
  const m = /^(\d+)\.(\d+)\.x$/.exec(max)
  if (m) {
    const [maj, min] = String(server).split('.').map(Number)
    return maj < +m[1] || (maj === +m[1] && min <= +m[2])
  }
  return compare(server, max) <= 0
}

/**
 * Checks a catalogue. `problems` fail it; the notes only say what's still to do: modules with no
 * version for the newest server (`noNewest`), modules a server installs whose newest version is
 * built for an older module API, so they need a new release (`oldAPI`, as "id version (API n)"),
 * and versions with no `ui` summary (`noUI`).
 */
export function check(catalog) {
  const problems = [], noNewest = [], noUI = [], oldAPI = []
  let versions = 0
  for (const mod of catalog.modules || []) {
    let fitsNewest = false
    let newest = null
    for (const v of mod.versions || []) {
      versions++
      const at = `${mod.id} ${v.version}`
      if (!Number.isInteger(v.api) || v.api < MIN_API || v.api > MAX_API) {
        problems.push(`${at}: module API ${v.api}, and servers take ${MIN_API} to ${MAX_API}`)
        continue
      }
      const installed = INSTALLED.includes(v.delivery)
      const first = FIRST_SERVER[v.api]
      if (v.api >= SDUI_FROM_API && installed && compare(v.minServer, first) < 0) {
        problems.push(`${at}: built for module API ${v.api}, which carries sdui.json, so minServer must be ${first} or later, not ${v.minServer}`)
      }
      for (const p of statusProblems(v.status, v.statusNote)) problems.push(`${at}: ${p}`)
      if (v.api >= INTEGRATION_FROM_API && installed) {
        if (v.integration === undefined) {
          problems.push(`${at}: built for module API ${v.api}, which carries integration.json, and it has no integration summary: list it with \`wittymodule catalog-add\` from WittyModule 0.5.2 or later`)
        } else {
          for (const p of integrationProblems(v.integration)) problems.push(`${at}: ${p}`)
        }
      } else if (v.integration !== undefined) {
        problems.push(`${at}: an integration summary on a version built for module API ${v.api}, which carries no integration.json`)
      }
      if (v.api >= SDUI_FROM_API && installed && !v.ui) noUI.push(at)
      if (!v.withdrawn && compare(NEWEST_SERVER, v.minServer) >= 0 && atMost(NEWEST_SERVER, v.maxServer)) fitsNewest = true
      if (!v.withdrawn && installed && (!newest || compare(v.version, newest.version) > 0)) newest = v
    }
    if ((mod.versions || []).length && !fitsNewest) noNewest.push(mod.id)
    if (newest && newest.api < MAX_API) oldAPI.push(`${mod.id} ${newest.version} (API ${newest.api})`)
  }
  return { problems, noNewest, noUI, oldAPI, versions }
}

function main(file) {
  const r = check(JSON.parse(fs.readFileSync(file, 'utf8')))
  if (r.noUI.length) {
    console.log(`note: versions with sdui.json and no ui summary (list them with a wittymodule that writes one): ${r.noUI.join(', ')}`)
  }
  if (r.oldAPI.length) {
    console.log(`note: modules whose newest version is built for an older module API than ${MAX_API}, which need a new release for API ${MAX_API}: ${r.oldAPI.join(', ')}`)
  }
  if (r.noNewest.length) {
    console.log(`note: no listed version fits server ${NEWEST_SERVER} yet: ${r.noNewest.join(', ')}`)
  }
  if (r.problems.length) {
    for (const p of r.problems) console.error(`✗ ${p}`)
    process.exit(1)
  }
  console.log(`ok ${file}: ${r.versions} versions, module API ${MIN_API} to ${MAX_API}`)
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2] || 'catalog.json')
}
