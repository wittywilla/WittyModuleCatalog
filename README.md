# WittyModuleCatalog

The list of modules a WittyMediaServer can install: one signed file, `catalog.json`, saying which modules exist, every version of each, what each is for, what it asks for, which servers it fits and where its files are. You read it through the store in the app. You only need this repository to list a module.

## What it does

A server's store reads this list. Modules stay in their own repositories, and this one holds none of their code.

The catalogue only **offers**. What runs is decided by the signed checksum list and manifest in each module's own release, and an install is refused if they disagree with the catalogue. So this repository can't make anything run on anyone's server, and its signature doesn't vouch for more than the list.

## How to get it

You don't fetch it by hand. A server's store reads it in **Settings → Modules**, which needs WittyMediaServer 0.6.0-alpha or later, and nothing older.

It's published at `https://github.com/wittywilla/WittyModuleCatalog/releases/download/catalog/catalog.json`, with `catalog.json.sig` and the module icons beside it. They're replaced whenever `catalog.json` or an icon changes on `main`.

## What it needs

Nothing to read. To change it:

- Go, for the `wittymodule` tool in [WittyModule](https://github.com/wittywilla/WittyModule), whose `Catalog` is the code that reads and checks this file.
- Node.js, for the icon script.

## Platforms

There's no program here: the file is the same for a server on any system. The scripts are run on Linux by the GitHub workflows, and those have not run yet.

## Building and testing

CI checks the file and the icons:

```bash
go run github.com/wittywilla/wittymodule/cmd/wittymodule catalog-check catalog.json
```

```bash
node scripts/make-icons.mjs --check
```

**How it changes.** `scripts/refresh.sh` looks at every listed module's GitHub releases and adds any version not yet listed, once that release's signature checks out. The **refresh** workflow runs it four times a day, and when asked from the Actions tab. **publish** then signs the new file and puts it on the `catalog` release.

**To list a new module,** add it to `catalog.json` by hand with `"versions": []` and raise `serial`, or run:

```bash
go run github.com/wittywilla/wittymodule/cmd/wittymodule catalog-add -catalog catalog.json -pub <module public key> <folder of its release files>
```

Versions are never edited after they're listed. To take one back, set `withdrawn` on it, as well as using the withdraw workflow in the module's own repository, and raise `serial`.

**Icons.** Each module's icon is `icons/<id>.png`, drawn by `scripts/make-icons.mjs`: a rounded square in its category's colour with one simple white mark. Never a console's, disc format's, service's or anyone else's logo.

`node scripts/make-icons.mjs` draws them all and writes each one's size and SHA-256 into `catalog.json`, and `--check` fails if the two disagree. A new module needs a mark added to that script first, and an icon that changes needs `serial` raised.

In `catalog.json` an icon's `url` is only its file name. The catalogue's addresses are relative to the catalogue itself, and a GitHub release can't hold folders, so **publish** uploads the icons flat beside `catalog.json`. An icon isn't signed on its own: the signed catalogue gives its SHA-256.

The format is described in the modules guide in **Help** inside WittyMediaServer.

## Licence

Apache-2.0: see [LICENSE](LICENSE) and [NOTICE](NOTICE). If you redistribute it or build on it, keep the NOTICE attribution. The icons are drawn by the script here.

## Legal

WittyModuleCatalog is an independent open-source project. It isn't associated with, sponsored by or endorsed by any
publisher, rights holder, service or other media software project. No media comes with it. Any third-party names here
only describe what the modules work with, and belong to their owners. It's provided “as is”, with no warranty; see
[LICENSE](LICENSE). Local law applies to how you use it. This isn't legal advice.
