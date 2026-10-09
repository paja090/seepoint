# Základ Akademie — implementace 9. 10. 2026

## Připraveno v kódu

- `/academy`: katalog a hledání bez diakritiky, filtrované serverem podle aktivní organizace, role a dostupného modulu.
- `/academy/lessons/[slug]`: krátké kroky, předpoklady, upozornění, verze, stav ověření a bezpečný odkaz do příslušné agendy.
- `/academy/manage`: příprava pěti pilotních návrhů, redakční náhled, přehled podnětů dané organizace.
- Hlášení problémů pro celou lekci nebo konkrétní krok; validace, rate-limit, kontrola originu a tenant ownership na serveru.
- Čtyři nové modely a připravený migrační soubor; složené FK mezi tenant-owned entitami. Záznamy vznikají až explicitní akcí správce, nikoli při načtení stránky.
- Vypnutý výchozí tenant flag `academy`; zapnutí nezvyšuje práva k původním modulům.
- Pět pilotů je MEDIA_PENDING, s prázdným ověřením/publikací. Běžným zaměstnancům se návrhy nevydávají za hotové školení.
- Malé opravy AUD-01 až AUD-04: veřejný `/p`, oprávnění odkazu na sklad, shodná dostupnost realizace, společná validace navigačního výběru.

## Ověřeno

- Prisma validate a generování lokálního klienta prošly. Migrační SQL bylo vytvořeno offline z rozdílu dvou schémat.
- [36 regresních testů](regression-tests.txt) prošlo; zahrnují migraci do PGlite v paměti, přístupová pravidla, obsah, tenant scope a navigační výběr. Po poslední úpravě viditelnosti menu znovu prošlo všech [9 policy testů](final-policy-tests.txt); jde o podmnožinu, počty se nesčítají.
- ESLint nad novými Academy stránkami/API/komponentami/službami a novými unit testy skončil exit 0.
- Cílený strict TypeScript nad Akademií, jejími importy a novými unit testy skončil exit 0; opakování přes `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p tests/academy.tsconfig.json`.
- `node scripts/check-tenant-security.mjs`: OK. `git diff --check`: bez whitespace chyb; hlášeny pouze běžné CRLF konverze existujících souborů.
- [Browser test](browser-check.txt): skutečné komponenty katalogu a formuláře, syntetická data, simulovaná odpověď API. Odeslaný request neobsahuje klientem určenou organizaci; potvrzení funguje, bez JS chyb a bez horizontálního přetečení při 360 px. Desktop/mobil vizuálně zkontrolovány. [Desktop](component-desktop.png), [mobil](component-mobile.png).
- Celoprojektový TypeScript při dokončeném běhu s 4 GB heap hlásí pouze [dvě existující chyby](typecheck-existing-errors.txt) v `tests/ai-realization-intelligence.test.ts:976–977`: volitelný action.targetUrl. Tento test nebyl upraven. Jeden dřívější opakovaný běh vyčerpal výchozí heap. Globální typecheck proto není označen za úspěšný.

## Hranice této fáze

Produkční ani sdílená DB nebyla migrována, nic nebylo nasazeno a nikomu nebyl zapnut modul. Nebyla ověřena skutečná session/API komunikace celého SeePointu nad tenanty A/B; browser smoke izoluje komponenty. Snímky výše nejsou screenshoty přihlášené aplikace ani vizuály pro výuku obchodních procesů.

Publikace obsahu, školicí cesty, evidence dokončení, skutečné screenshoty/videa, průvodce a AI patří do navazujících fází. Obchodní postupy nebudou označeny VERIFIED bez autentizovaného průchodu a odborné kontroly. Zbývající nálezy auditu nebyly automaticky refaktorovány.

Postup zapnutí v izolovaném prostředí a opakování testů: [docs/academy-foundation.md](../../docs/academy-foundation.md).
