Module icons, one `<id>.png` for each module, 128 by 128. WittyMediaServer's `scripts/genicon` draws them (run
`scripts/sync-brand.sh`), so change the marks there rather than these files; `scripts/make-icons.mjs` then records
each file's size and SHA-256 in `catalog.json`. **publish** uploads them flat to the `catalog` release, beside
`catalog.json`. See the README at the top of this repository.
