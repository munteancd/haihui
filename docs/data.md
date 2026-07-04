# City data

Source: GeoNames `cities500.zip` (https://download.geonames.org/export/dump/cities500.zip),
licensed CC-BY 4.0. Attribution required in the app footer: "City data © GeoNames (CC BY 4.0)".

`tools/build-cities.mjs` reads the unzipped `cities500.txt` (tab-separated) and writes
`data/cities.json`: the top ~50 cities per country by population.

Columns used (0-indexed) from the GeoNames dump:
- 1 = name, 8 = country code, 14 = population, 4 = latitude, 5 = longitude.
