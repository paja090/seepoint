# Návrh architektury a bezpečný implementační plán

Vše níže je návrh, nikoli popis existující Akademie. Zachovat Next.js App Router, React, Tailwind a stávající Prisma/PostgreSQL. Nepřidávat druhý identity systém, druhý CRM ani paralelní business workflow.

## Obrazovky desktop/mobil

**Desktop:** stávající AppShell a kontextové menu; Akademie jako trvalá dostupná pomůcka, ne jen další položka AI Hubu. Hlavička s organizací a aktivní rolí. Nad katalogem osobní cesta „Pokračovat“, povinné lekce a skutečně dokončený počet. Vyhledávání „Co potřebujete udělat?“; karty kategorií ukazují dostupný obsah, nikoli marketingové počty. Žádná fiktivní hodnota „3 z 8“ v živém produktu.

**Detail lekce:** nadpis, účel, role, délka, předpoklady, datum/commit ověření; očíslované krátké kroky, skutečný screenshot s anotací a alternativním textem; časté chyby; kontextový odkaz; volitelný průvodce/video. CTA „Ověřit porozumění“; otevření stránky samo nevyplní průběh. Akce „Nahlásit problém s návodem“ u celku i konkrétního kroku.

**Mobil:** jednořádková hlavička, hledání a pokračování; kategorie v jednom sloupci; detail po jednom kroku nebo plynulým scrollováním. Screenshot lze zvětšit, text není zapečen do obrázku. Ovladače minimálně přibližně 44 px, bez horizontálního scrollu při 360 px, safe-area nad stávající spodní navigací. Video bez autoplay, české titulky a přepis. Průvodce musí přežít otevření klávesnice i odmítnutí GPS.

**Správce:** přiřazení cesty osobě/roli, povinné lekce a termín; tabulka zaměstnanců „nezahájeno / rozpracováno / dokončeno / nutné obnovení / blokováno přístupem“. Rozlišení vlastníků obsahu a správců zaškolení. Čekající vizuál, neověřený krok, nenalezený výsledek, odebrané oprávnění, neplatný odkaz a výpadek média mají samostatné čitelné stavy.

Přiložený návrh UI je interaktivní koncept se syntetickými daty, nikoli důkaz současného vzhledu. Přepínač role v konceptu slouží jen náhledu návrhu; v reálném produktu nesmí změnit oprávnění.

## Datový návrh

V první verzi všechny záznamy vlastní konkrétní `Organization`. Globální výchozí lekce distribuovat jako verzovaný obsahový balíček, z nějž vzniknou tenant-owned revize. Zabrání to složité výjimce „organizationId=null znamená veřejné“ ve stávajícím tenant guardu. Později lze oddělit read-only globální zdroj, ale neotevírat tenant dotazy nullable tenantem.

| Model (navržený) | Klíčová pole / vztahy |
|---|---|
| AcademyCategory | id, organizationId, slug, title, order, archivedAt; unique(org,slug) |
| AcademyLesson | id, organizationId, categoryId, slug, sourceTemplateKey, publishedRevisionId, ownerUserId, archivedAt; unique(org,slug) |
| AcademyLessonRevision | id, organizationId, lessonId, version, title, description, status, targetRoles, requiredCapabilities, estimatedMinutes, prerequisites, completionPolicy, contentHash, sourceCommit, verifiedAt/by, approvedAt/by, publishedAt, supersedesRevisionId; unique(org,lesson,version) |
| AcademyLessonStep | id, organizationId, revisionId, position, instruction, expectedResult, warning, targetKey, routeKey, actionMode, mediaId; unique(org,revision,position) |
| AcademyMedia | id, organizationId, revisionId, kind, provider, storageKey, mimeType, size, checksum, width/height/duration, captionKey, transcript, altText, captureManifest, reviewedAt; média mimo Photo/FieldSurveyPhoto |
| AcademyLearningPath | id, organizationId, slug, title, targetRoles, version, archivedAt |
| AcademyLearningPathItem | id, organizationId, pathId, lessonId, order, required, minimumVersion; unique(org,path,lesson) |
| AcademyAssignment | id, organizationId, pathId, pathVersion, userId, assignedBy, dueAt, status; zachovat snapshot povinností |
| AcademyLearningProgress | id, organizationId, userId, lessonRevisionId, status, openedAt, lastStepId, completedAt, completionMethod, score, evidenceId; unique(org,user,revision) |
| AcademyFeedback | id, organizationId, lessonRevisionId, stepId?, reporterId, category, message, sanitizedRouteKey, status, assignedTo?, resolvedAt; žádné automatické přikládání citlivého screenshotu |
| AcademySourceDependency | id, organizationId, revisionId, repoPath, routeKey?, targetKey?, fingerprint, lastCheckedCommit |
| AcademyAuditEvent | id, organizationId, actorId, entityId, type, timestamp, redactedChange; append-only historie publikace, změn a přiřazení |

Nejde o hotové Prisma schéma ani migrační SQL. Při implementaci použít složené vazby `(organizationId,id)` a odpovídající unique indexy, aby například krok tenantu A neodkazoval na médium B. Do tenant seznamu/metadat a security testů přidat všechny modely. JSON requiredCapabilities validovat proti internímu registru; nikdy nepřijímat role nebo organizationId z klienta jako autoritativní hodnotu.

## Serverové rozhraní a oprávnění

Navržené API: GET `/api/academy/catalog`, GET `/api/academy/lessons/[slug]`, GET `/api/academy/media/[id]`, POST `/api/academy/progress`, POST `/api/academy/feedback`, POST `/api/academy/ask`; oddělené admin endpointy pro revisions, publish, paths, assignments a reporting.

1. Ověřit session, aktivní organizaci a členství stávajícími helpery.
2. Vyhodnotit `academy` read capability pro všechny aktivní pracovní role včetně VIEWER. Správa obsahu a cesty jsou nové explicitní capabilities, default ADMIN; rozšíření na MANAGER musí být vědomé rozhodnutí.
3. Každá lekce má také capabilities popisované činnosti. Filtrovat na serveru před katalogem, vyhledáváním, AI retrieval a výdejem média. „Vidím sekci“ není „smím provést schválení“.
4. Znepřístupněný modul nevydá skrytý obsah přes ID, fulltext, autocomplete, počty ani AI odpověď. VIEWER může mít samostatné read-only lekce.
5. Rozpracovaný obsah vidí jen jeho oprávnění redaktoři. Přímý odkaz na draft není cesta kolem publikace.
6. Admin reporty pouze v aktivní organizaci. Lektor nemůže přiřazením cesty udělit zaměstnanci přístup do financí. Správce platformy je oddělen od firemního správce.

Znovu použít `lib/page-auth.ts`, `lib/api-auth.ts`, `lib/module-policy.ts`, `tenant-context.ts`, `tenant-prisma.ts`. Před napojením sjednotit rozdílné policy menu, viz AUD-02/03. Oprávnění se počítají na request, nikoli trvale zapečená do cache. Cache klíč musí zahrnovat tenant, efektivní capabilities, verzi katalogu a jazyk; změna členství cache invaliduje.

## Dokončení, verze a publikace

Otevření uloží openedAt a IN_PROGRESS. Krátký kvíz nebo vědomé potvrzení konkrétního výsledku může uzavřít jednoduchou lekci; rozlišit completionMethod=QUIZ/SELF_ATTESTED/PRACTICAL_VERIFIED. Server ověří odpovědi či bezpečnou existenci výsledku ve správném tenantu. U obchodních činností nevyžadovat odeslání či přijetí skutečné nabídky jako důkaz absolvování; použít testovací prostředí nebo porozumění postupu.

Publikovaná revize se nepřepisuje. Nová verze vytváří nový záznam. Historické dokončení staré verze zůstává, zásadní změna může přidat REQUIRED_REFRESH. Redakční oprava překlepu jej nemusí vyvolat. Povinné cesty mají snapshot verze a pravidlo opětovného zaškolení.

READY vyžaduje: browser ověření na odpovídajícím buildu; odborné schválení; skutečná schválená média nebo výslovně text-only lekce; fungující odkazy; přístupnost; vyřešené blokující nálezy. Publikace je samostatná autorizovaná akce s historií. OUTDATED v katalogu viditelně označit; kriticky chybný postup stáhnout z doporučování a AI odpovědí.

## Interaktivní průvodce

Navrhnout malý klientský TourProvider na AppShell, načítaný až na vyžádání. Registry `tourId → revision → steps`. Stabilní nový atribut `data-academy-target="offer.navigation.targets"`, nikoli selektor podle pozice DOM. Atributy v současném UI dosud nebyly doplněny; navržené klíče nejsou existující tlačítka.

Step nese routeKey, targetKey, text, placement, allowedAction a completionPredicate. Kroky: instrukce → zvýraznění → uživatel provede dovolenou interakci → ověřený signál stavu → další krok. Průvodce nikdy sám nekliká na smazání, odeslání nabídky, souhlas klienta, fakturaci či přesun stavu. Oprávnění změny zůstává v původní službě. Pozorované události obsahují jen krok/stav, nikoli klientská data.

Chybějící cíl nebo změněná route: průvodce bezpečně ukončit a nabídnout text lekce; neposunout se slepě. K dispozici Zpět, Přeskočit, Ukončit; Escape, vrácení focusu, čtečka, reduced motion. Při změně role/organizace zrušit aktivní průvodce a načíst oprávnění znovu. Tour progress není automaticky dokončená lekce.

## Opakovatelná tvorba screenshotů a videí

**Zjištěná dostupnost:** projekt má `@playwright/test`, E2E scénáře a konfigurační soubor. Současná konfigurace má screenshots/trace off a videa nezapíná. Testovací prostředí ani přihlášení nebylo potvrzeno. `ffmpeg` nebyl nalezen přes Get-Command v PATH; samostatné renderování finálních videí proto není v tuto chvíli ověřené. Existence balíčku Playwright sama nezaručuje nainstalovaný browser/recording runtime.

Při závěrečné kontrole nebyl nalezen bundled Chromium headless shell. Místní Chrome přes `channel: 'chrome'` fungoval pro render a testování izolovaného UI konceptu. To potvrzuje dostupnost browser automation pro budoucí screenshoty, nikoli autentizované prostředí, záznam videa nebo funkčnost SeePoint workflow.

Playwright podporuje screenshot celé stránky i konkrétního prvku. Navrhuji zachytit stav po dokončení načítání, uložit originál a oddělená data anotací. [Oficiální dokumentace screenshotů](https://playwright.dev/docs/screenshots).

Playwright umí záznam videa; nahrávku je třeba finalizovat uzavřením browser contextu. Dokumentace také uvádí anotace akcí, jejich dostupnost je nutné porovnat s konkrétní nainstalovanou verzí. [Oficiální dokumentace videí](https://playwright.dev/docs/videos).

Navržený pipeline:

1. Zafixovat commit buildu, datasetVersion a explicitní disposable DB/tenant. Samostatné fixture účty pro sedm rolí a tenant B. E-mail sink, žádní reální příjemci; mapy a externí AI s fixture odpověďmi označit jako simulované. E2E s reálnou integrací vést zvlášť.
2. Manifest lekce: lessonId/revision, sourcePaths, routeKey, role, moduleFlags, locale cs-CZ, viewport, seed scénář, targetKeys, assertions, capture timestamp. Snímat desktop 1440×900 a mobil 390×844; ovládání navíc kontrolovat na 360 px.
3. Autentizace do fixture účtu, známá organizace, stabilní data. Před zachycením assert nadpisu, správného kroku a výsledku. Při změně targetu capture selže, nevygeneruje klamavé médium.
4. Obrázek PNG/WebP + JSON bounding boxů zvýraznění; anotace šipkou/číslem jako prezentační overlay, původní screenshot neměnit generativním nástrojem. Alt text popisuje relevantní ovládací prvek. Anonymizace vychází především ze syntetických dat, maskování je druhá obrana.
5. Video po činnostech 1–3 min: stejný scénář, pomalejší kroky a krátké zastávky, zaznamenané souřadnice kliknutí/časové značky. Raw záznam poté offline render job: kurzor/kruh kliknutí, cílený výřez a zoom, střih pauz. Ověřit instalaci FFmpeg s potřebnými filtry, případně použít dostupný editor; neslibovat hotový renderer, dokud není smoke test. České WebVTT titulky a textový přepis z ověřeného scénáře. Hlas volitelný a zvlášť schválený; není nutnou podmínkou lekce.
6. Recenze skutečných médií člověkem: zda odpovídají UI, žádná citlivá data, rozlišení čitelné na telefonu, titulky synchronní. Teprve potom READY. Test, že se přehraje celý soubor a uzavřel se recording context.
7. Uložit médium pod tenant/revision/checksum. Obrázky mohou využít adapterové konvence současného storage, ale **nevytvářet Photo ani FieldSurveyPhoto**. Pro video navrhnout samostatný media adapter s podporou streamingu/range requests; nepřenášet velká videa do DB fallbacku určeného fotkám. Výběr konkrétního storage a limitů patří do technického spike. Soukromé médium přes autorizovaný endpoint nebo krátce platný scoped URL.
8. V přehrávači video controls, poster, track kind=captions srclang=cs, přepis a fallback při 403/404. Zvlášť měřit přenosy a nechat bez autoplay. Smazání lekce archivuje, nesmaže sdílená média jiné revize.

Artefakty nesmí obsahovat hesla, session storageState, tokenové URL, HAR s kontakty ani screenshoty reálných smluv. Přihlašovací stav patří do ignorovaného dočasného úložiště. Opakovaný capture musí být deterministický a staré schválené médium nepřepsat před recenzí.

## Detekce zastarání

AcademySourceDependency mapuje lessonRevision na skutečné soubory komponent, page/API/policy i tour targety. CI porovná změněné cesty a hash závislostí, připraví seznam dotčených lekcí a capture diffs. Změna sdíleného AppShell, auth nebo storage zasáhne více lekcí než změna jedné stránky. Změna textu tlačítka, odstraněný target nebo route = revize potřebná; stroj nesmí automaticky označit novou verzi VERIFIED.

Oddělit předběžný CI nález v PR od zastarání nasazeného UI. Až potvrzený deployment/nová content baseline označí příslušné lekce OUTDATED v daném prostředí. Pravidelná kontrola stáří (např. 90 dní jako navržená politika) a zpětná vazba doplňují diff; samotné stáří neprokazuje chybu.

## AI asistent Akademie

Stávající projekt používá `lib/ai-gemini.ts`, doménové AI služby, `lib/ai-usage.ts` a rate-limit. Neexistenci univerzálního `/api/ai/assistant` nelze nahradit tvrzením, že `/chat` je AI asistent. Nový academy endpoint má využít stávající přístup ke konfiguraci provideru, telemetry/usage a limitům, s jedním úzce zaměřeným adaptérem pro text; nepřidávat další SDK, databázi nebo identity framework bez důvodu.

Pro první verzi stačí hledání nad dostupnými názvy, synonymy a kroky; čeština potřebuje např. nabídka/cenovka, nosič/plocha. AI retrieval přidat nad publikované a stále ověřené revize. Nejprve autorizovaný subset → pak retrieval → model. Nevyhledávat globálně a neskrývat citlivý výsledek až po generování. Neindexovat klientské obchodní údaje pro školicí otázky.

Odpověď: krátký postup + citace lessonRevision/step + autorizovaný moduleRoute + verification/verifiedAt. Model smí odkazovat pouze na ID poskytnutá retrieval; server odmítne smyšlený odkaz a libovolnou URL. Při nedostatku důkazů „Pro tento postup zatím nemám ověřený návod“ a nabídka vyhledání/podnětu. OUTDATED může být nabídnuto pouze jako výslovně zastaralý odkaz, ne jako autoritativní rada. Dokumenty, feedback a dotazy jsou nedůvěryhodná data; nesmějí změnit systémové instrukce.

Bez tool calling obchodních mutací; asistent jen vysvětluje a naviguje. „Proč nevidím fotografie?“ znamená vysvětlit možné kroky, nikoli tvrdit, že provedl diagnostiku konkrétní zakázky. Budoucí diagnostika by potřebovala zvlášť autorizované read-only nástroje.

Při výpadku/kvótě vrátit běžné hledání. Usage log v aktivním tenantu s ASSISTANT a rozlišujícím academy metadata, nebo nová enum hodnota až v samostatně schválené migraci. Ukládat minimum dotazů; nepublikovat automaticky výstup AI jako novou lekci.

## Fáze implementace a akceptace

Odhady jsou pracovní rozsah pro jednoho vývojáře a dostupného vlastníka obsahu; nejsou závazný harmonogram. Obsah a schvalování bývají delší než samotný katalog.

| Fáze | Rozsah | Vstup / výstupní brána | Odhad |
|---|---|---|---|
| 0 — ověřená základna | zafixovat checkout, testovací tenant A/B, reprodukovat AUD-01–06; po souhlasu malé izolované opravy | bezpečné prostředí, žádná produkční data; pět kritických průchodů s evidence | 2–4 dny + opravy dle výsledku |
| 1 — základ Akademie | schválené nové modely, katalog, server RBAC, lekce a feedback, 5 pilotů, základní hledání | migrace nejprve na disposable DB; isolation/media/link testy; modul za flagem | 5–8 dní |
| 2 — zaškolení a redakce | cesty, přiřazení, completion, admin report, revize/publikace/archiv | otevření != dokončení; history a změny role ověřeny | 4–6 dní |
| 3 — média a průvodce | capture manifest, první 2 tours, 1 video, titulky, kontextová nápověda | pouze skutečné UI; bez automatických závazných kliknutí; mobilní QA | 4–7 dní |
| 4 — AI a údržba | authorized retrieval, zdrojové citace, fallback, dependency CI | testy neexistujících postupů, tenantů, injekcí a OUTDATED | 4–6 dní |
| 5 — rozšíření obsahu | zbylých 106 témat po doménových dávkách | odborný vlastník každé kategorie a kontinuální revize | samostatná kapacita redakce |

Každá fáze samostatná malá sada změn/PR. Akademie má vypínatelný flag, který neovlivní původní moduly. Žádné runtime DDL. Rollback nejprve vypnout vstup/flag a vrátit aplikaci; zachovat dokončení a publikované revize, neprovádět destruktivní down migration. Nasazení a DB migrace nejsou touto analýzou schváleny.

## Testovací plán a důkaz nezávislosti

| Oblast | Nutný test a očekávání |
|---|---|
| Role | všech 7 rolí × viditelnost katalogu, detailu, média, hledání, AI a admin; direct URL nesmí obejít UI filtr; změna aktivní role okamžitě platí |
| Tenant | A/B s podobnými slugs, cizí ID ve všech GET/POST, feedback, přiřazení, progress, media Range a AI; bez úniku metadata/počtů/bytes |
| Publikace | draft/published/outdated/archived, idempotentní publish, revize, neplatný source link; stará dokončení zachována |
| Pokrok | refresh a dvě zařízení, opakovaný POST bez duplicit, otevření nic nedokončí, vlastní userId ze session; admin nemůže omylem měnit jiný tenant |
| Média | PNG/WebP/video/captions, 403/404, odvolané oprávnění, pomalá síť, Range, velký soubor, MIME validace a kontrola příloh |
| Průvodce | stabilní target, chybějící target, modální okno, změna route, Escape, back/skip/end, klávesnice/čtečka; nulová automatická obchodní mutace |
| Mobil | 360/390 px, velké písmo, landscape, klávesnice, touch, zoom screenshotu, safe-area a spodní lišta |
| AI | otázky z promptu, neexistující tlačítko, jiný tenant, nepovolená finance, malicious feedback, outdated lekce, provider timeout; vždy citace nebo přiznané neověření |
| Regrese | navigace dvě schválení a dvě provozovny, konverze/idempotence, fotografie a reporty, souběžná obsazenost, výroba/instalace/fakturace, Field Survey nezávislost, dokumenty |

Důkaz, že Akademie nic nezměnila: v izolovaných fixtures před/po procházení a dokončení lekcí porovnat počty/ID a relevantní hodnoty `Photo`, `FieldSurveyPhoto`, `Offer`, `NavigationOrder`, `Occupancy`, `WorkOrder`, `ClientDocument`, `ClientInvoice`. Očekávat pouze zápisy Academy*. U otevření průvodce zachytit síťové mutace: žádné POST do business endpointů bez výslovného kliknutí uživatele. Ve CI spustit příslušné stávající testy + nové integration/E2E, nikoli jen snapshoty textu.

Před každým pilotním zveřejněním musí být jasně zaznamenáno kdo, kdy, nad kterým buildu a v jaké roli workflow skutečně prošel. Aktuální audit tento runtime certifikát neposkytuje.
