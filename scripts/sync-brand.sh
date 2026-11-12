#!/bin/sh
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 WittyWilla and contributors
#
# Draws this repository's icons, backgrounds and in-app brand marks with WittyMediaServer's
# genicon, the one generator for the whole family (WittyMediaServer's docs/BRAND.md). Never edit
# the pictures by hand: change the drawings there and run this.
#
#   scripts/sync-brand.sh            write them
#   scripts/sync-brand.sh --check    change nothing; fail if any is out of date
#
# WITTY_SERVER is the WittyMediaServer checkout (default: beside this repository).
# WITTY_BRAND_CONCEPT picks the design: wink (the one in use), monogram or signal.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
server=${WITTY_SERVER:-$here/../WittyMediaServer}
check=""
[ "${1:-}" = "--check" ] && check="-check"
if [ ! -f "$server/scripts/genicon/main.go" ]; then
  echo "WittyMediaServer isn't at $server: set WITTY_SERVER to its checkout." >&2
  exit 1
fi
cd "$server"
go run ./scripts/genicon -target catalog -o "$here" -concept "${WITTY_BRAND_CONCEPT:-wink}" $check
# The catalogue records each icon's size and SHA-256: bring catalog.json up to date (or check it).
if [ -z "$check" ]; then node "$here/scripts/make-icons.mjs"; else node "$here/scripts/make-icons.mjs" --check; fi
