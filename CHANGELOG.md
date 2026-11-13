# Changelog

What changed in how this catalogue works, newest first. What changed in a module is in that module's changelog.

## Unreleased

- Every module's icon is redrawn in the family's new look (the apps' dark tile, the mark and a glow in the category's colour, the server's amber dot in the corner) by WittyMediaServer's `scripts/genicon`, the one generator for all the family's icons; `scripts/sync-brand.sh` draws them and `scripts/make-icons.mjs` now only records them in `catalog.json`. `serial` is raised.
- A version's `status` and `statusNote`, and `ui`, a summary of its `sdui.json`: the README says what they are, and `scripts/check-api.mjs` refuses a status a server doesn't know and an `experimental` or `incomplete` version with no note (one line of at most 500 characters), and notes API-4 versions with no `ui` yet.
- Ready for module API 4, where every version carries `sdui.json`: the README says what an entry for an API-4 version needs, and `scripts/check-api.mjs` (in CI, publish and refresh) checks that each version's module API is one a server takes and that an API-4 version's `minServer` is 0.8.0-alpha or later. Versions listed for API 3 are unchanged and stay valid.
- WittyStats has its description and icon, which CI and publishing need.
- `stays`, `updates`, `summary`, `requires` and `core` now say what each module's own `module.json` says. Some still described built-in copies that have gone.
- First version: format 1, with every module listed and no versions yet.
- Every module now has a description, a category and an icon, and WittyDisc and WittyModule are listed.
- Icons are drawn by `scripts/make-icons.mjs`, which keeps their sizes and hashes in `catalog.json`, and are published
  on the `catalog` release beside the catalogue.
