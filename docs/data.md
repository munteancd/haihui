# Card data

All coordinates and populations come from GeoNames (https://www.geonames.org), licensed
CC BY 4.0. Attribution is in the app footer: "Date geografice © GeoNames (CC BY 4.0)".
Nothing is typed in by hand.

## Lume — `data/cities.json`

Source: GeoNames `cities500.zip` (https://download.geonames.org/export/dump/cities500.zip).
`tools/build-cities.mjs` reads the unzipped `cities500.txt` (tab-separated) and writes the
top ~50 cities per country by population.

Columns used (0-indexed) from the GeoNames dump:
- 1 = name, 8 = country code, 14 = population, 4 = latitude, 5 = longitude.

## România — `data/romania.json`

Built by `tools/build-romania.mjs` from the GeoNames dump for Romania:

```
node tools/build-romania.mjs                       # downloads RO.zip from GeoNames itself
node tools/build-romania.mjs path/to/RO.txt        # or use an unzipped RO.txt
node tools/build-romania.mjs path/to/cities500.txt # cities only (no attractions)
```

Output: `{ source, builtFrom, builtAt, cities: [...], attractions: [...] }`.
- **cities** (140): every county seat (GeoNames `PPLC`/`PPLA`, plus Buftea for Ilfov) and
  then the most populous other towns. Each has `id` (GeoNames id), `name` (Romanian
  spelling, comma-below ș/ț), `county` ("Județul Mureș" / "Municipiul București"), `lat`,
  `lon`, `pop`. City districts (`Sector 1`…) are skipped. A county seat with an
  implausibly small population (< 15 000, a GeoNames slip) gets `popSuspect: true`: it
  stays in the cardinal game but is left out of the population game.
- **attractions** (up to 38): matched by name (Romanian or English, ignoring diacritics)
  inside their county in the full dump, never typed in. `kind: "attraction"`, no `pop`, so
  they only play in the cardinal variant. The script prints one line per attraction
  (`OK` / `AMBIGUOUS` with the other candidates / `MISSING`); once an id is confirmed it
  can be pinned with `geonameId` in the script's `ATTRACTIONS` list.

Admin1 code → county names in the script were checked against GeoNames' own admin1 list
(all 42 match).

### Current build (TODO: rebuild from RO.txt)

The committed file was built from GeoNames' `cities500.txt`, because the build machine
could not reach geonames.org. It came from the npm package `cities-500-structured@1.0.1`,
which bundles GeoNames' `cities500.txt` (a snapshot from March 2023; its coordinates
matched `data/cities.json` for all 50 Romanian cities there). Consequences until it is
rebuilt from `RO.txt`:
- populations are GeoNames' 2023 values, mostly older than the 2021 census;
- Călărași has a wrong population in that snapshot (6 687), so it is `popSuspect`;
- only one attraction (Sulina, a town) is found; the other 37 need the full dump.

Running `node tools/build-romania.mjs` on any machine that can reach
download.geonames.org refreshes the populations, adds the attractions and re-checks
Călărași; then commit the new `data/romania.json` and bump `CACHE` in `sw.js`.

## Precision

Cards show coordinates in whole degrees and minutes (`46° 46' N`, `24° 42' E`). The game
compares at that same precision (`toArcMinutes` in `src/geo-format.js`), so two cards that
read the same are equal, and equal counts as correct.
