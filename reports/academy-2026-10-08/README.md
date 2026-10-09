# SeePoint OS — audit a návrh Návody & Akademie

Analýza zahájena 8. 10., dokončena 9. 10. 2026. **Pouze návrh; modul nebyl implementován.**

## Rozhodnutí k předložení

Doporučuji `/academy` jako společný vstup, krátké obrázkové lekce podle pracovních úkolů a samostatný přehled zaškolení. Nejprve opravit potvrzené rozpory mezi menu a oprávněními a sjednotit schvalování navigačního výběru. V první implementaci dodat katalog, oprávnění, verzování, pět pilotních lekcí a evidenci dokončení. Video, průvodce a AI přidávat až nad ověřeným obsahem.

Nejdůležitější rozdíl proti původní představě: schválení lokalit navigace ještě **není schválení ceny ani objednání výroby**. Dále existují tři odlišné terénní činnosti: fotografie existujících nosičů, průzkum navigační zakázky a nezávislý Field Survey.

## Výstupy

1. [Inventura funkcí a mapa workflow](01-inventura-workflow.md).
2. [UX a funkční audit, reprodukce a priority](02-audit.md).
3. [Struktura a katalog lekcí](03-katalog-lekci.md), včetně rolí a stavů.
4. [Architektura, média, AI, plán implementace a testů](04-architektura-plan.md).
5. [Prvních pět ukázkových lekcí](05-ukazkove-lekce.md).
6. Návrh desktopové a mobilní obrazovky v interaktivním náhledu přiloženém v konverzaci. Je to návrh, nikoli screenshot aplikace. Jeho zdroj je také uložen jako `academy-ui.html` v tomto adresáři.
7. [Úplný index 110 stránek](route-index.md) a [strojový inventář](inventory.json): 306 route handlerů, 123 Prisma modelů, 142 souborů unit testů, 8 E2E specifikací. Počty označují soubory/entity, nikoli počet obchodních funkcí nebo prošlých testů.
8. [Výsledek vybraných testů](test-results.txt), [lokální reprodukce](reproductions.txt), [tenant kontrola](tenant-security.txt).
9. [Ověření návrhu UI](ui-verification.txt), [desktopový koncept](concept-desktop.png), [mobilní koncept](concept-mobile-home.png) a [mobilní detail lekce](concept-mobile-lesson.png). Tyto snímky zachycují pouze návrh, ne současnou aplikaci.

## Co přesně bylo ověřeno

- Místní checkout repository `https://github.com/paja090/seepoint`, HEAD `417402a83d7194f8b6585bf002b5c77805f004e7` plus existující necommitnuté změny. Vzdálený HEAD GitHubu ani produkční verze nebyly porovnány; aktuálnost vůči nim není potvrzena.
- Kompletní mechanický index stránek, handlerů a modelů; ruční hloubkový průchod klíčových workflow, guardů, menu, uploadu, schvalování nabídky a vybraných AI služeb. **Nejde o ruční audit každého řádku všech 306 handlerů.** U dalších modulů jde o inventuru a návrh ověřovacích scénářů.
- 81 vybraných testů prošlo, 0 selhalo, 0 přeskočeno. Část testuje čisté funkce nebo přítomnost konstrukcí ve zdrojovém kódu; výsledek není důkaz E2E funkčnosti, skutečné DB izolace ani externích integrací.
- Tři problémy byly reprodukovány přímým spuštěním middleware/policy funkcí se syntetickými vstupy bez sítě a databáze. `node scripts/check-tenant-security.mjs` hlásí OK; statický guard není plný penetrační test.
- Autentizovaný prohlížeč, reálné úložiště, odesílání e-mailů, mapové a AI API nebyly ověřeny. Nebyla dodána URL bezpečného testovacího prostředí; `.env.e2e.local` nebyl nalezen. Žádné skutečné screenshoty ani videa nebyly pořízeny. Není potvrzeno, že ostatní `.env` míří na testovací DB, proto nebyly použity k pokusným zápisům.
- Nebyly spouštěny migrace, seed, build připojený k DB, produkční nasazení ani obchodní akce. Nové soubory jsou pouze analytické podklady a lokální reprodukce v této složce.

## Legenda důkazů

`CODE_INDEXED`: nalezená route/model; funkčnost neprokázána. `CODE_REVIEWED`: přečtená relevantní implementace. `LOCAL_TESTED`: spuštěná konkrétní funkce/test. `BROWSER_VERIFIED`: bezpečný autentizovaný průchod; v tomto auditu žádný. `UNVERIFIED`: chybí podmínky k ověření. Stav lekce je jiná osa, viz katalog.

Pracovní strom již obsahoval změny veřejné navigační dokumentace, realizace, `lib/rbac.ts`, `lib/public-tenant.ts`, tenant kontrol a nové testy veřejných fotografií. Závěry v těchto oblastech platí pro přečtený pracovní strom, nikoli pouze commit. Před implementací zopakovat ověření nad zafixovanou verzí.

Během práce byl mimo tento audit vytvořen nový HEAD `fd4aa3092d64aea7717946f85e80ee1c40180771` (změny realizace a RBAC). Audit jej nevytvářel. Tři lokální reprodukce AUD-01/02/03 byly znovu úspěšně zopakovány i nad tímto HEAD; limit 100 v realizaci zůstal přítomen. Inventář byl na konci znovu vygenerován. Vybraných 81 testů odpovídá dřívějšímu běhu nad rozpracovaným stavem, nejde o novou kompletní regresi finálního HEAD.

Vizuální koncept byl vykreslen v místním Chrome pomocí Playwrightu, ověřeny přepínače role a mobilu, hledání, kroky, kvíz a simulovaný feedback; na 360 px bez horizontálního přetečení a bez JS chyb. Desktop i mobil byly také vizuálně zkontrolovány. Tento test se nepřihlašoval do SeePointu a neprováděl obchodní akce.

## Priorita

Není doložena celosystémová P0 chyba. Tři potvrzené lokální rozpory a několik nálezů podložených kódem jsou popsány jednotlivě; nepovyšuji hypotézy na prokázané produkční incidenty. Publikaci lekce vždy blokuje neověřený kritický krok jejího workflow.

**Schvalovaná další práce:** fáze 0 a 1 z implementačního plánu, tedy bezpečné E2E ověření a základ Akademie. Rozšíření DB, změny stávajících modulů a nasazení zůstávají samostatnými rozhodnutími po schválení návrhu.
