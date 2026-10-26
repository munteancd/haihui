# Card data

All coordinates and populations come from GeoNames (https://www.geonames.org), licensed
CC BY 4.0. Attribution is in the app footer: "Date geografice © GeoNames (CC BY 4.0)".
Nothing is typed in by hand.

## Lume and Europa — `data/cities.json`, `data/europe.json`

Source: GeoNames `cities500.zip` (https://download.geonames.org/export/dump/cities500.zip),
every populated place with 500+ people. `tools/build-cities.mjs` builds both decks:

```
node tools/build-cities.mjs                  # downloads cities500.zip from GeoNames itself
node tools/build-cities.mjs path/to/cities500.txt
```

Each card: `{ id, name, country, lat, lon, pop, tier }` — `id` is the GeoNames id, `country`
the ISO code (the app shows it in Romanian), `tier` the easiest difficulty the card plays at.

- **Which cities.** Per country the most populous ones (50 for Lume, 60 for Europa),
  skipping city sections (`PPLX`), a second city with the same name in the same country,
  and any city within 15 km of a bigger one already taken (districts and suburbs such as
  Brooklyn or "Paris 17", which would sit on top of their neighbour on the board).
- **Europe** is every European country, Cyprus included, plus Russia west of 60° E and
  Turkey's European side (north of 40.8° N and west of 29° E: Istanbul and East Thrace).
  The Caucasus and Kazakhstan are left out.
- **Tiers** (`DECKS` in the script). Tier 1 (Ușor) takes capitals first, then the most
  populous cities whose name GeoNames lists in at least 25 spellings/languages (a sign the
  city is known abroad: Paris has 109, an obscure prefecture seat a dozen), at most 10 per
  country for Lume (6 for Europa, which also needs 400 000+ people outside the capitals).
  Tiers 2 and 3 relax the limits; the rest is tier 4
  (Legendar). A name already used in an easier tier waits for a harder one, so an easy game
  never has two "Alexandria"s. Today: Lume 200 / 800 / 2 000 / 7 740 cards cumulatively,
  Europa 85 / 335 / 935 / 2 232. `DECKS.sizes` in `src/decks.js` must match (a test checks).
- Names are GeoNames' main names, with Romanian spelling for Romania and Moldova
  (comma-below ș/ț, București, Chișinău).

Columns used (0-indexed) from the GeoNames dump: 0 id, 1 name, 3 alternate names (only
counted), 4 latitude, 5 longitude, 7 feature code, 8 country code, 14 population.

## România — `data/romania.json`

Built by `tools/build-romania.mjs` from the GeoNames dump for Romania:

```
node tools/build-romania.mjs                       # downloads RO.zip from GeoNames itself
node tools/build-romania.mjs path/to/RO.txt        # or use an unzipped RO.txt
node tools/build-romania.mjs path/to/cities500.txt # cities only (no attractions)
```

Output: `{ source, builtFrom, builtAt, cities: [...], attractions: [...] }`.
- **cities** (140): every county seat (GeoNames `PPLC`/`PPLA`, plus Deva for Hunedoara
  and Buftea for Ilfov, which GeoNames doesn't flag) and then the most populous other
  towns. Each has `id` (GeoNames id), `name` (Romanian spelling, comma-below ș/ț),
  `county` ("Județul Mureș" / "Municipiul București"), `lat`, `lon`, `pop`. City districts
  (`Sector 1`…) are skipped. A county seat with an implausibly small population
  (< 15 000, a GeoNames slip) gets `popSuspect: true`: it stays in the cardinal game but is
  left out of the population game. Today that is Călărași (GeoNames says 6 687).
- **attractions** (38): castles, monasteries, ancient sites, caves, lakes, peaks, dams…
  Each is pinned to its GeoNames id in the script's `ATTRACTIONS` list (the comment next
  to it is the name GeoNames uses), so a rebuild can't drift to another place.
  `kind: "attraction"`, no `pop`, so they only play in the cardinal variant. Where
  GeoNames leaves the county blank (Lacul Roșu) the entry names it.
  To add one, give `counties` + `match` names instead of an id: the script searches the
  dump (Romanian or English names, diacritics ignored) and prints `OK` / `AMBIGUOUS` (with
  the other candidates) / `MISSING`, then pin the id it found.

Admin1 code → county names in the script were checked against GeoNames' own admin1 list
(all 42 match).

### Choosing the attractions

GeoNames doesn't have every famous Romanian sight. Missing from the RO dump (October
2026): Sfinxul and Babele in the Bucegi, Transfăgărășan, Peștera Urșilor, Cascada Bigăr,
Chipul lui Decebal, Vulcanii Noroioși, Cheile Turzii and Cheile Bicazului, Salina Praid,
Cimitirul Vesel, the Sighișoara/Râșnov/Alba Carolina/Suceava/Neamț citadels,
Sarmizegetusa Regia, Putna and Curtea de Argeș monasteries, Podul lui Dumnezeu. Lacul
Sfânta Ana is there but only as 46.2, 26 (a tenth of a degree), too coarse for cards
read to the minute, so it was left out. The 38 were picked from well-known sights GeoNames has with precise points. Never
fill a gap from memory: add a sight only once a source with real coordinates has it.

### Rebuilding

`node tools/build-romania.mjs` (and `node tools/build-cities.mjs` for Lume/Europa) on a
machine that can reach download.geonames.org, then commit the `data/` files, update
`DECKS.sizes` in `src/decks.js` if the tier counts moved, and bump `CACHE` in `sw.js`. The
committed files were built from the October 2026 dumps.
