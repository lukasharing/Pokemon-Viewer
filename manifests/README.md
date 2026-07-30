# Source manifests

This directory contains reproducible, exact-ROM symbol manifests. They are
generated from clean `pret` checkouts and linker output; they are not guessed
address catalogs.

## Current generated profiles

| Profile | ROM SHA-1 | Source |
| --- | --- | --- |
| Pokémon Red (international) | `ea9bcae617fdf159b045185467ae58b2e4a48b9a` | `pret/pokered@405b6246372d7e5a2cb029cbb65219b13286b8c9` |
| Pokémon Blue (international) | `d7037c83e1ae5b39bde3c30787637ba1d4c48ce2` | `pret/pokered@405b6246372d7e5a2cb029cbb65219b13286b8c9` |
| Pokémon Crystal (international Rev 0) | `f4cd194bdee0d04ca4eac29e09b8e4e9d818c133` | `pret/pokecrystal@3438c7003a57fa2987fcb223d14b660761b33c64` |
| Pokémon Emerald (English Rev 0) | `f3ae088181bf583e55daf962a92bb46f4f1d07b7` | `pret/pokeemerald@83df84e40623b79281f2397faa611cbf044170bd` |
| Pokémon FireRed (English Rev 1) | `dd5945db9b930750cb39d00c84da8571feebf417` | `pret/pokefirered@df4449a27cd78dd747ce269e47d3ab4a0149d8f4` |

`config/` declares required labels. `generated/` is the deterministic output.
`js/core/source-manifest-registry.js` is the browser form of the same data.
The default test suite compares both forms field-for-field so they cannot drift
silently.

Resource groups state what each root supports and the depth currently proven.
They deliberately say `root`/`partial-roots`: an address alone does not prove a
record count, byte extent, pointer owner or safe write capability.

The Red/Blue species manifests include both the ordinary `BaseStats` table and
the source-accurate `MewBaseStats` exception. Validate a legally built/reference
ROM against its complete canonical Pokédex spine with:

```bash
npm run audit:gen1-species -- /path/to/pokered.gbc manifests/generated/gen1-red.json
npm run audit:gen1-species -- /path/to/pokeblue.gbc manifests/generated/gen1-blue.json
```

The audit checks the complete ROM fingerprint, all 151 canonical internal-ID
mappings, base records, Pokédex entry pointers, cry records, compressed front
pictures, 47 trainer classes, all 415 bounded trainer records, both party
formats, all 1,061 party-member Species links, 165 move records/names, 87
effect identities and handler owners, 55 TM/HM assignments, 3,037
Species compatibility links, 165 animation
pointers, 165 sound records, all 190 bounded progression records, 72 canonical
evolutions, 728 level-up entries and the resulting 3,368-node / 8,436-edge graph
without printing ROM strings or bytes.

Ruby, Sapphire, LeafGreen, Crystal Rev 1 and non-English builds remain
ungenerated. Their existing compatibility entries are audit results, not
source-symbol manifests.

Project-specific manifests use the same core schema plus `engineProfile`.
They are imported from an editor File menu and stored by complete ROM
fingerprint. Bundled manifests always take precedence, and imported manifests
never grant stock write audits. See [`doc/ROM_HACKS.md`](../doc/ROM_HACKS.md).
