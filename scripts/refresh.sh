#!/usr/bin/env bash
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
