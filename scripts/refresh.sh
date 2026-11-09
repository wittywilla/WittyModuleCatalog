#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# WittyModuleCatalog - The signed list of modules a WittyMediaServer can install.
# Copyright (C) 2026 WittyWilla and contributors
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <https://www.gnu.org/licenses/>.

# Adds every released version of every listed module that isn't listed yet. Each release has
# to pass catalog-add's checks first: signed with the module key, and its files matching that
# signed list. Nothing is ever changed or removed here.
#
#   MODULE_PUBLIC_KEY=<base64> scripts/refresh.sh
#
# Needs gh, signed in, and the tool, which $WITTYMODULE can name (default: go run at a release).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

: "${MODULE_PUBLIC_KEY:?the public key modules are signed with}"
tool=${WITTYMODULE:-go run github.com/wittywilla/wittymodule/cmd/wittymodule@v0.3.0}

# Is this version of this module in the catalogue already?
listed() {
  python3 -c '
import json, sys
c = json.load(open("catalog.json"))
for m in c["modules"]:
    if m["id"] == sys.argv[1] and any(v["version"] == sys.argv[2] for v in m["versions"]):
        sys.exit(0)
sys.exit(1)
' "$1" "${2#v}"
}

modules=$(python3 -c '
import json
for m in json.load(open("catalog.json"))["modules"]:
    print(m["id"], m["repo"])
')

while read -r id repo; do
  tags=$(gh release list -R "$repo" --limit 50 --exclude-drafts --json tagName --jq '.[].tagName' 2>/dev/null || true)
  for tag in $tags; do
    case "$tag" in v[0-9]*) ;; *) continue ;; esac
    if listed "$id" "$tag"; then
      continue
    fi
    work=$(mktemp -d)
    if gh release download "$tag" -R "$repo" -D "$work/release" >/dev/null &&
      gh api -H 'Accept: application/vnd.github.raw' "repos/$repo/contents/CHANGELOG.md?ref=$tag" >"$work/CHANGELOG.md" &&
      $tool catalog-add -catalog catalog.json -pub "$MODULE_PUBLIC_KEY" -changelog "$work/CHANGELOG.md" -publisher WittyWilla "$work/release"; then
      :
    else
      echo "::warning::$id $tag wasn't listed" >&2
    fi
    rm -rf "$work"
  done
done <<<"$modules"
$tool catalog-check catalog.json
