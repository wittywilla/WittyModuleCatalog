// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors

// node --test scripts/
import test from 'node:test'
import assert from 'node:assert/strict'
import { check, integrationProblems } from './check-api.mjs'

const version = (o = {}) => ({ version: '0.4.0', delivery: 'helper', api: 5, minServer: '0.8.0-alpha', maxServer: '0.8.x', ui: { pages: [] }, ...o })
const summary = { routes: 12, screens: ['/couch', '/couch/:id'], settings: ['Game PCs'], data: true, feature: 'games' }
const one = (...versions) => check({ modules: [{ id: 'wittycouch', versions }] })

test('an API 5 version a server installs has its integration summary', () => {
  assert.deepEqual(one(version({ integration: summary })).problems, [])
  assert.deepEqual(one(version({ integration: {} })).problems, []) // it adds nothing to a server, and says so
  const [p] = one(version()).problems
  assert.match(p, /wittycouch 0\.4\.0: .*no integration summary/)
  // A library is never installed on its own and carries none.
  assert.deepEqual(one(version({ delivery: 'library' })).problems, [])
})

test('an integration summary holds only what a server reads, within its limits', () => {
  assert.deepEqual(integrationProblems(summary), [])
  assert.deepEqual(integrationProblems({ ...summary, scans: ['games'] }), [])
  for (const bad of [
    null, [], 'twelve routes',
    { routes: -1 }, { routes: 1001 }, { routes: 1.5 },
    { screens: ['couch'] }, { screens: Array(65).fill('/a') }, { screens: '/couch' },
    { settings: ['Game\nPCs'] }, { settings: [' '] }, { settings: Array(33).fill('A') },
    { data: 'yes' }, { feature: 'Games!' }, { scans: ['Games'] }, { lifecycle: true },
  ]) {
    assert.notDeepEqual(integrationProblems(bad), [], JSON.stringify(bad))
  }
})

test('only API 5 versions carry an integration summary', () => {
  const [p] = one(version({ api: 4, integration: summary })).problems
  assert.match(p, /built for module API 4/)
})

test('modules whose newest version is for an older API are noted, not refused', () => {
  const r = one(version({ version: '0.2.1', api: 3, minServer: '0.6.0-alpha', maxServer: '0.6.x', ui: undefined }))
  assert.deepEqual(r.problems, [])
  assert.deepEqual(r.oldAPI, ['wittycouch 0.2.1 (API 3)'])
  // Once an API 5 version is listed, the module needs nothing more.
  const r2 = one(version({ version: '0.2.1', api: 3, minServer: '0.6.0-alpha', maxServer: '0.6.x' }), version({ integration: summary }))
  assert.deepEqual(r2.oldAPI, [])
})

test('the API range, minServer and status are still checked', () => {
  assert.match(one(version({ api: 6, integration: summary })).problems[0], /servers take 3 to 5/)
  assert.match(one(version({ minServer: '0.7.0-alpha', integration: summary })).problems[0], /minServer must be 0\.8\.0-alpha/)
  assert.match(one(version({ status: 'incomplete', integration: summary })).problems[0], /statusNote/)
  assert.deepEqual(one(version({ api: 4, ui: undefined })).noUI, ['wittycouch 0.4.0'])
})
