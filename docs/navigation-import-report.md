# Report importu navigací

Datum importu: 2. 7. 2026

Zdrojové listy byly načteny pouze pro čtení:

- Orlová 2025
- Ostrava 2025
- Havířov 2025
- Frýdek-Místek 2025

## Ověřený rozsah

| Město | Navigace | Fyzické body | Bez GPS | Body s více navigacemi |
|---|---:|---:|---:|---:|
| Orlová | 11 | 11 | 0 | 0 |
| Ostrava | 284 | 266 | 19 | 15 |
| Havířov | 116 | 94 | 2 | 19 |
| Frýdek-Místek | 19 | 19 | 0 | 0 |
| **Celkem** | **430** | **390** | **21** | **34** |

- Klienti v náhledu: 65
- Řádky k ruční kontrole: 185
- Chybějící řádky v plánu: 0
- Nadbytečné řádky v plánu: 0
- Duplicitní interní identifikátory po opravě: 0
- Maximální průměr GPS skupiny: 8,97 m
- Skupiny nad limitem 10 m: 0
- Hash finálního plánu: `405522cc`

## Výsledek zápisu

První transakce vytvořila všech 390 fyzických bodů a 427 navigací. Tři navigace byly přeskočeny kvůli shodným interním identifikátorům u rozdílných řádků. Generování identifikátorů bylo opraveno a druhý idempotentní běh vytvořil pouze chybějící 3 navigace.

Finální kontrola databázového API:

- 390 importovaných fyzických bodů
- 430 importovaných navigací
- 21 importovaných bodů bez GPS
- 0 chybějících navigací
- 0 duplicitních navigací vytvořených opravným během

Zdrojová Google tabulka nebyla při náhledu ani importu změněna.