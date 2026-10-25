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

`node tools/build-romania.mjs` on a machine that can reach download.geonames.org, then
commit `data/romania.json` and bump `CACHE` in `sw.js`. The committed file was built from
the October 2026 RO dump.
