# Dispečink práce – fáze 4: společné plánování

Navazuje na fáze 1–3. Nahrazuje omezení fáze 2, kdy se návrhy rozdělovaly podle zdroje a terénní kampaně.

- Jeden výběr práce může zahrnovat zakázky, navigace a body více terénních akcí. Datum, posádka a vozidlo se volí ve společném plánovači.
- Terénní adaptér používá stejný převod bodů jako původní plánovač. Zachovává média, vybavení, kapacity a dvojice vyzvednutí/předání.
- Schválení přiřadí jednotlivé terénní kroky v jedné transakci s běžnou prací. Změna přiřazení jiným dispečerem vrátí celou operaci zpět. Nenaplánovaná práce zůstává ve frontě.
- Pokračování další den podporuje smíšené výjezdy. Přesune pouze nedokončenou práci se stejnou posádkou a vozidlem, zachová problémy, částečné množství a předání materiálu. Termíny, absence a rezervace mohou přesun zablokovat. Časy a přejezdy jsou převzaté a označené jako orientační.
- Opakování požadavku nevytváří další výjezd. Hotové běžné body zůstávají v původním plánu; přesunuté body se nezobrazují dvakrát.
- Přístup kontroluje organizaci a aktivní moduly. Nejsou potřeba databázové migrace ani nové paralelní modely.

Ověření: tests/unified-dispatch.test.ts (kombinace zdrojů, kapacita, spojené kroky, oddělení organizací, souběžná změna, rollback, opakování a pokračování); stávající testy schválení, fronty a přesunu; browser fixture tests/dispatch-planning.browser.mjs pro částečné schválení a pokračování do společného dispečinku. Testovací data jsou simulovaná.

Nasazení pouze do preview PR 475. Izolace databáze preview není prokázána; neprovádět v ní zápisy do reálných provozních dat. Původní cesty a API zůstávají dostupné. Trvalá offline fronta fotografií není součástí této fáze.
