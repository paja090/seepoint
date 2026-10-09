# Akademie — základ modulu

Implementace první fáze: `/academy`, `/academy/lessons/[slug]`, `/academy/manage`; katalog s českým hledáním, serverová kontrola přístupu, pět pilotních návrhů a ukládání podnětů. Nejde o dokončené zaškolení celé aplikace.

## Zapnutí po schválené migraci

1. Zkontrolovat a aplikovat `20261009010000_academy_foundation` nejprve na izolované testovací DB, až následně schváleným deployment postupem. Žádná runtime DDL ani automatický seed. V rámci této práce se sdílená ani produkční DB nemění.
2. Explicitně povolit `enabledModules.academy=true` pro testovací organizaci. Výchozí stav je vypnuto i pro INTERNAL/ENTERPRISE.
3. ADMIN otevře `/academy/manage` a tlačítkem připraví pět pilotů jen pro aktivní organizaci. Opakovaný bootstrap nepřepisuje existující revize.
4. Redakční náhled je `/academy?preview=1`; samotný query parametr bez role ADMIN nic nezpřístupní. I administrátor musí mít dostupnou doménu lekce.
5. Všech pět pilotů má MEDIA_PENDING a prázdné verifiedAt/publishedAt. Běžný uživatel je neuvidí. Publikace, správa cest a evidence dokončení patří do další fáze; v tomto základu není publikovací endpoint ani falešný ukazatel školení.

Pokud flag někdo zapne před migrací, UI ukáže přípravu Akademie, API vrátí 503. Vypnutí flagu zablokuje route/API a skryje menu bez zásahu do ostatních modulů.

## Bezpečnost a data

Modely AcademyCategory, AcademyLesson, AcademyLessonRevision a AcademyFeedback obsahují organizationId. Složené cizí klíče chrání vazbu kategorie–lekce–revize–feedback. Service znovu ověřuje actor/module a zavádí tenant kontext; nepoužívá platformPrisma. Feedback přebírá autora a organizaci výhradně ze session. Přímá ID cizí revize nevracejí obsah. Query vyřazuje archivované lekce i revize. Žádný klientský HTML obsah, libovolné URL ani média se nevykreslují.

Lesson capability je serverový whitelist. Oprávnění lekce může být užší než sekce; interní přijetí nabídky není lekce pro SALES. Revize je běžnému uživateli dostupná jen jako PUBLISHED s verifiedAt a publishedAt. Budoucí redakční služba musí zajistit skutečnou verifikaci, schválení a neměnnost publikované revize; samotné ruční přepnutí enum v DB není publikační workflow.

České hledání nyní normalizuje diakritiku a hledá všechny zadané výrazy v názvu, popisu a kategorii **po serverovém filtrování oprávnění**. Není to AI ani sémantické hledání. API vrací private/no-store a stránka je dynamická.

Bootstrap má pouze idempotentní vložení Academy*; při čtení se nic neukládá. Feedback nesnímá obrazovku ani nepřikládá tokenové URL. Správce vidí nejnovějších maximálně 100 podnětů své organizace. Vyřešení a notifikace budou součástí redakční fáze.

## Malé opravy z auditu

- AUD-01: `/p/[token]` projde middleware k existující validaci veřejného tokenu; `/p-private` zůstává neveřejné.
- AUD-02: odkaz na sklad vyžaduje stejnou sekci warehouse jako stránka.
- AUD-03: menu a page/API policy sdílejí výpočet dostupnosti včetně existujícího work → aiRealization fallbacku. Doménové role se nemění.
- AUD-04: oba endpointy výběru navigačních bodů používají společnou validaci veřejných/interních ID; prázdné/cizí/duplicitní výběry jsou odmítnuty. Starší `/respond` už nesmí tiše přijmout chybějící selectedPointIds. Je to záměrné zpřísnění vstupu. Kompletní DB/E2E konverze a souběhy nadále vyžadují testovací prostředí.
- AUD-05 až AUD-08 zůstávají mimo tento základ (souhrny nad 100 objednávek, mobilní rozpracovanost, terminologie a starší README).

## Ověření

`tests/academy.test.ts` kontroluje role, moduly, verifikaci, tenant scope, feedback vstupy a opravené menu/middleware. `tests/academy-migration.test.ts` aplikuje skutečný migrační soubor do PGlite v paměti, kontroluje cizí klíče mezi tenanty a nedotčenou syntetickou tabulku Photo. To není potvrzení kompletní produkční DB ani autentizovaných E2E scénářů. `tests/navigation-selection.test.ts` ověřuje společnou validaci bodů.

Opakovatelný browser smoke test skutečných komponent (se simulovaným feedback API): nejprve `node node_modules/tailwindcss/lib/cli.js -i app/globals.css -o tmp/academy-ui.css --minify`, pak `node tests/academy-ui.browser.mjs`. Používá místní Chrome, localhost a syntetická data; nečte session ani databázi aplikace. Ověřuje render, request formuláře, potvrzení, JS chyby a šířku 360 px. Výstupy ukládá do tmp/academy-component-*.png; nejsou to screenshoty přihlášeného workflow SeePointu.

Cílená typová kontrola: `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p tests/academy.tsconfig.json`. Doplňuje celoprojektový typecheck, nenahrazuje jej; v této revizi celý projekt stále hlásí dvě původní chyby v testu realizace.

Další ověřovací brána: auth/browser nad bezpečným tenantem A/B, skutečné ukládání feedbacku a bootstrap, prohlídka pěti procesů a pořízení reálných screenshotů. Nevyužívat náhodnou lokální `.env` jako testovací databázi.

Při kontrole uploadu se navíc ukázalo, že `/api/mobile-photos/upload` používá section guard carriers, který připouští i VIEWER; v tomto handleru nebyla nalezena samostatná kontrola zapisovací role. To je samostatný nález k ověření/opravě RBAC focení, nikoli důvod dát VIEWER mutační lekci. Akademie proto foticí lekce VIEWER nezpřístupňuje. Produkční request se pro ověření neodesílal.
