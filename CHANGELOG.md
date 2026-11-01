# Changelog

What changed in how this catalogue works, newest first. What changed in a module is in that module's changelog.

## Unreleased

- WittyStats has its description and icon, which CI and publishing need.
- `stays`, `updates`, `summary`, `requires` and `core` now say what each module's own `module.json` says. Some still described built-in copies that have gone.
- First version: format 1, with every module listed and no versions yet.
- Every module now has a description, a category and an icon, and WittyDisc and WittyModule are listed.
- Icons are drawn by `scripts/make-icons.mjs`, which keeps their sizes and hashes in `catalog.json`, and are published
  on the `catalog` release beside the catalogue.
