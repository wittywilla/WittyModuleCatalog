# WittyModuleCatalog

The list of modules a WittyMediaServer can install: one signed file, `catalog.json`, saying which modules
exist, every version of each, what each is for, what it asks for, which servers it fits and where its files are.
A server's store reads it. Modules themselves stay in their own repositories, and this one holds none of their code.

The catalogue only **offers**. What runs is decided by the signed checksum list and manifest in each module's own
release, and an install is refused if they disagree with the catalogue. So this repository can't make anything run
on anyone's server, and its signature doesn't vouch for more than the list.

## Where it is

`https://github.com/wittywilla/WittyModuleCatalog/releases/download/catalog/catalog.json`, with `catalog.json.sig`
and the module icons beside it. They are replaced whenever `catalog.json` or an icon changes on `main`.

The format is described in
[WittyMediaServer's docs/MODULES.md](https://github.com/wittywilla/WittyMediaServer/blob/master/docs/MODULES.md#the-catalogue),
and `Catalog` in [WittyModule](https://github.com/wittywilla/WittyModule) is the code that reads and checks it.

## How it changes

`scripts/refresh.sh` looks at every listed module's GitHub releases and adds any version not yet listed, once that
release's signature checks out. The **refresh** workflow runs it four times a day, and when asked from the Actions tab.
**publish** then signs the new file and puts it on the `catalog` release.

To list a new module, add it to `catalog.json` by hand with `"versions": []` and raise `serial`, or run:

```bash
go run github.com/wittywilla/wittymodule/cmd/wittymodule@latest catalog-add -catalog catalog.json -pub <module public key> <folder of its release files>
```

Versions are never edited after they're listed. To take one back, set `withdrawn` on it, as well as using the
**Withdraw a version** workflow in the module's own repository, and raise `serial`.

## Icons

Each module's icon is `icons/<id>.png`, drawn by `scripts/make-icons.mjs`: a rounded square in its category's colour
with one simple white mark. Never a console's, disc format's, service's or anyone else's logo.

`node scripts/make-icons.mjs` draws them all and writes each one's size and SHA-256 into `catalog.json`, and with
`--check` it fails if the two disagree, which CI and **publish** both test. A new module needs a mark added to that
script first, and an icon that changes needs `serial` raised, as any other change does.

In `catalog.json` an icon's `url` is only its file name. The catalogue's addresses are relative to the catalogue
itself, and a GitHub release can't hold folders, so **publish** uploads the icons flat beside `catalog.json`. An icon
isn't signed on its own: the signed catalogue gives its SHA-256.

WittyModuleCatalog is developed by WittyWilla. Apache-2.0.

## Legal

WittyModuleCatalog is an independent open-source project. It isn't associated with, sponsored by or endorsed by any
publisher, rights holder, service or other media software project. No media comes with it. Any third-party names here
only describe what the modules work with, and belong to their owners. It's provided “as is”, with no warranty; see
[LICENSE](LICENSE). Local law applies to how you use it. This isn't legal advice.
