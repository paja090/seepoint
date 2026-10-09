# Akademie – rozšíření pro všechny agentury, 9. 10. 2026

- Společný katalog šesti publikovaných lekcí, 14 chráněných snímků; dvě nové lekce: mapové podklady a hledání klienta.
- `/academy` a kompatibilní `/academy/review` zobrazují stejné ověřené materiály. Žádný seznam povolených tenantů.
- Vyžadována aktivní organizace a shodné aktivní členství. Lekce i přímá URL obrázků respektují přístup k Nabídkám/CRM.
- Sdílené snímky jsou výslovně označená autorizovaná školicí data. Žádná živá data jiné organizace se nenačítají.
- Evidence dokončení, role learning paths, video a interaktivní průvodci nejsou touto verzí implementováni.
- Tenantový editor a databázové API zůstávají za původním příznakem. Bez migrací.
- Ověřeno živě jako ADMIN na desktopu; ostatní role a jiné organizace testovány na autorizační politice, ne přihlášením do všech agentur.
- 12 souvisejících testů prošlo, cílený ESLint a úplná kontrola TypeScript prošly.
- Produkční balíček: uložený HEAD 4de34ffe2dee2953735d0068438202e5759f7ded + pouze vyjmenované změny Akademie; rozpracované změny autentizace a scratch-find-user.mjs nejsou součástí.

## Nezařazený postup: platnost nabídky

Při browser průchodu bylo do pole data platnosti v prvním kroku navigační nabídky zadáno 30. 11. 2026. Po Uložit nabídku navigace se zobrazilo potvrzení uložení. Následující schvalovací přehled stále hlásil Platnost nabídky – Chybí. Příčina ani persistence v DB nebyly ověřeny. Snímky 13 a 14 jsou jen evidence tohoto rozporu, nejsou publikované. Nelze zatím tvrdit, že zadání data úspěšně prošlo. Je potřeba opakovat kontrolu editoru po novém načtení a dohledat payload ukládání.
