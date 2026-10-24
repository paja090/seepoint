# Izolované testovací nasazení dispečinku – 24. 10. 2026

## Rozsah a zdroj

Uživatel výslovně schválil vytvoření a nasazení samostatné testovací verze s ukázkovými daty. Produkční projekt seepoint nebyl změněn; neproběhl merge ani push do main.

- Zdroj: čistý export aa8a115 (redesign d08bb86) a oprava lockfilu e10ba08.
- Vercel projekt: seepoint-dispatch-test, prj_CAXHy6ZKWPtU673gKk9i2YiPKbOo.
- Nasazení READY: dpl_5pj2n9isjhUV7BhtZ6dN7tqeupzg (preview).
- URL: https://seepoint-dispatch-test-c881gljg0-pavels-projects-073588fb.vercel.app
- Neon projekt: seepoint-dispatch-test-db, purple-block-71528549, Frankfurt, Free; větev br-ancient-leaf-b9lrp14r.
- Nebyla kopírována žádná produkční data. Dvě ukázkové firmy, čtyři testovací účty, dva technici, dvě vozidla a deset prací (osm v původním scénáři, dvě dodatečné volné práce).

## Oddělení prostředí

Samostatný Vercel projekt má pouze vlastní databázové připojení a nově vytvořený klíč; žádné produkční Google Drive, e-mailové, OAuth ani AI klíče nebyly přeneseny. SEEPOINT_STORAGE_PROVIDER=DATABASE ukládá fotografie přímo do testovací databáze. Kontrolní SQL po opakovaném uploadu potvrdilo jednu fotografii, 68 bajtů, storageProvider DATABASE a prázdné driveFileId. Testovací vercel.json neobsahuje crony.

Nová prázdná databáze byla ověřena před inicializací a inicializována aktuálním Prisma schématem přes db push; nejde o ověření historické migrační posloupnosti. Nevznikla nová aplikační migrace a nebyly změněny produkční tabulky. Zápisové testy byly omezeny kontrolou přesného hostname nové databáze a přesného testovacího deploymentu.

Přístupové údaje jsou pouze lokálně v ignorovaném tmp/dispatch-test-pristup.md; nejsou součástí nasazení ani tohoto protokolu. Preview zůstává chráněné Vercel přístupem a běžným přihlášením aplikace. Automatické ověření použilo krátkodobý OIDC token pouze pro origin tohoto projektu; token nebyl posílán poskytovatelům map.

## Oprava instalace

Vzdálené npm ci odhalilo chybějící optional platformní závislosti unrs-resolver 1.12.2 a připnutou vnořenou @emnapi/runtime 1.10.0. Doplněno 26 záznamů do package-lock.json, bez změn existujících verzí či package.json. Prošlo npm ci --dry-run --ignore-scripts a následně skutečné npm ci na Vercelu. Vzdálený build, kontrola typů, 138 statických stránek i vytvoření serverless funkcí prošly.

## Ověřené scénáře přes skutečná API a databázi

- Přihlášení dispečera a techniků; načtení osmi skutečně uložených ukázkových prací.
- Společný výjezd dvou posádek pro běžné zakázky i terénní úkoly, včetně navázaného přesunu materiálu. Žádná nepřiřazená práce.
- Opakované generování stejného požadavku vrací stejný návrh; schválení používá původní schvalovací službu.
- Technik nemůže schvalovat plány; druhá organizace nemůže načíst cizí plán.
- Start výjezdu a práce, upload fotografie, opakovaný upload bez duplicity, dokončení a opakované potvrzení.
- Technik nahlásí problém; dispečer ho vidí v datech i ve frontě práce.
- Pokračování z 24. na 25. 10. 2026 (přechod na zimní čas): zachování problému, vyloučení jedné hotové zastávky, osm zbývajících kroků; opakování vrací stejný navazující plán.
- Zadání dvou nových volných prací přes DispatchIntake API; opakované odeslání nevytváří duplicity.
- Desktop a mobil v prohlížeči bez horizontálního přetečení a bez JavaScriptových výjimek. Skutečný RouteMap načetl uložené trasy, body fronty a externí dlaždice; ověřen mobilní režim Mapa.

Kontrolní výjezd cmvm8akmp0006l30849foka5l; pokračování cmvm8g32l0016l30846n0kv2g dne 2026-10-25. Doklady: tmp/dispatch-live-test.log, tmp/dispatch-live-continue.log, tmp/dispatch-live-map.log, tmp/dispatch-preview-verification.json a screenshoty tmp/dispatch-preview-live-desktop.png, tmp/dispatch-preview-live-mobile.png, tmp/dispatch-preview-live-map-mobile.png.

## Omezení

Toto je testovací prostředí, nikoli nasazení redesignu do ostrého SeePointu. Fotografie byly ověřeny databázovým adaptérem; produkční Google Drive integrace se zde záměrně nepoužívá. Přechod historických produkčních migrací nebyl tímto testem ověřen. Dřívější regresní sada 1119/0/5 zůstává platná pro aplikační kód; vzdálený instalační problém doplnil samostatnou opravu lockfilu. Přístup k preview může vyžadovat přihlášení vlastníka do Vercelu.

Bez Google Maps API klíče se přejezdy počítají existujícím odhadovým mechanismem; schválení odhadu bylo výslovně součástí testu. Nejde o ověření produkčního poskytovatele dopravních časů.

Krátká adresa https://seepoint-dispatch-test.vercel.app byla přiřazena ke stejnému ověřenému preview; odpovídá testovacímu NEXT_PUBLIC_APP_URL. Výchozí adresa ostrého projektu se neměnila.
