# UX a funkční audit

Priority: P0 blokující provoz systému; P1 zásadní problém workflow; P2 komplikované UX; P3 drobné zlepšení. Dopad je posouzení auditu, nikoli naměřená četnost v produkci. Žádná P0 nebyla doložena. Reprodukce níže jsou buď skutečně spuštěné lokální funkce, nebo explicitně popsané scénáře k E2E ověření.

## AUD-01 — P1: veřejný portál `/p/[token]` vyžaduje session

- **Důkaz LOCAL_TESTED:** `middleware.ts:18` (publicPathPrefixes) a `middleware.ts:40` (redirect); `app/p/[token]/page.tsx`; použití odkazu `app/production/PrintProductionDashboard.tsx:59`.
- Reprodukce: nový `NextRequest('http://academy.test/p/synthetic-token')` bez cookie → `middleware(request)`. Spuštěno v `audit-checks.ts`.
- Očekávání: veřejná stránka propustí request k validaci tokenu; neplatný token skončí bezpečnou chybou stránky, platný umožní klientský portál.
- Skutečnost: 307 na `/login` ještě před validací tokenu. Přihlášený interní tester problém snadno přehlédne. Neověřeno, jak často je tento odkaz sdílen klientům; `/campaign` tuto překážku nemá.
- Návrh: sjednotit kanonický veřejný portál nebo cíleně přidat `/p` mezi veřejné prefixy při zachování tokenových kontrol. Test anonymní platný/neplatný/odvolaný token, nulový únik mezi organizacemi. Nikoli obecné uvolnění autentizace.

## AUD-02 — P2: SALES vidí Sklad, ale stránka jej odmítne

- **LOCAL_TESTED:** `lib/navigation.ts:71` používá sekci `vehicles` pro `/warehouse`; `app/warehouse/page.tsx:23` vyžaduje `warehouse`; `lib/rbac.ts` sekci warehouse roli SALES nedává.
- Reprodukce: role SALES, organizace PRO s výchozími moduly → `getVisibleNavigation` obsahuje `/warehouse`; `canAccess('SALES','warehouse') === false`. Poté očekávaný E2E krok: kliknout Sklad.
- Očekávání: buď skrytý odkaz, nebo explicitně povolený přístup podle schválené role.
- Skutečnost: menu nabízí odkaz, guard stránky přesměruje na dashboard. Nejde o doložený bezpečnostní únik.
- Návrh: navázat položku menu na sekci `warehouse`, sdílet policy menu/stránky/API. Nepřidávat SALES nové pravomoci jen kvůli sjednocení UI.

## AUD-03 — P2: menu realizace a guard mají různé podmínky dostupnosti

- **LOCAL_TESTED:** `lib/module-policy.ts:24` dovoluje aiRealization také při zapnutém work; `lib/navigation.ts:111` filtruje podle `isModuleEnabled` bez tohoto fallbacku.
- Reprodukce: MANAGER, aktivní členství, work=true, aiRealization=false. `hasModuleAccess(...,'aiRealization','realization')` vrací true, menu `/realization` neobsahuje.
- Očekávání: dostupná agenda má dohledatelný vstup; zakázaný modul není obcházen fallbackem proti záměru konfigurace.
- Skutečnost: přímá URL je podle policy dostupná, menu ji skryje. Zda má work implikovat realizaci, je produktové rozhodnutí.
- Návrh: explicitně rozhodnout význam fallbacku a používat stejný výpočet všude, včetně budoucího katalogu lekcí.

## AUD-04 — P1: dvě cesty potvrzení navigačního výběru mají různé validace

- **CODE_REVIEWED; runtime DB neověřen:** `app/api/proposals/[token]/selection/route.ts:34–45` versus `lib/offers/service.ts:1212–1259`, volané z `app/api/proposals/[token]/respond/route.ts`.
- Hlavní UI používá `/selection` a zakazuje prázdný výběr. Endpoint mapuje veřejné klíče `point-N` na interní ID, odmítá cizí/duplicitní/prázdné vstupy a má kontrolu opakování.
- Druhá větev `/respond` pro accept+LOCATION_SELECTION vytváří Set z libovolného pole, porovnává jej přímo s interními ID a pak zapisuje „schváleno“. Prázdné pole vybere nula bodů, veřejné klíče také neodpovídají interním ID. Nejde o zápis do cizího tenantu; jde o nekonzistenci vlastního výběru a historie.
- E2E reprodukce k provedení pouze na fixture: platný token lokační nabídky; POST `/respond` s action=accept, platným syntetickým jménem/e-mailem, consent=true a selectedPointIds=[]; poté zkontrolovat uložené příznaky a event. Opakovat s `point-1` a neznámým klíčem. Tento request nebyl odeslán.
- Očekávání: stejné odmítnutí jako `/selection`, případně jednoznačné přesměrování na společnou doménovou operaci.
- Chování vyplývající z kódu: všechny body mohou být odznačeny při současném potvrzení schváleného výběru; count eventu může odpovídat cizím vstupním ID, nikoli skutečně vybraným bodům.
- Návrh: společná validační a transakční služba pro oba endpointy, kanonická ID, alespoň jeden platný bod, idempotence, zamítnutí již uzavřené fáze. Teprve pak označit lekci o schvalování jako READY.

## AUD-05 — P1: souhrn realizací neoznačuje omezení na 100 nejnovějších zakázek

- **CODE_REVIEWED, podmíněný dopad:** `app/realization/page.tsx:25–51`, `:99`. Soubor byl už před auditem změněný.
- Reprodukce k E2E: tenant s více než 100 nezrušenými CrmOrder; starší nedokončená zakázka s chybějící fotkou; otevřít `/realization` a porovnat s úplným DB součtem.
- Očekávání: KPI „Aktivní zakázky“ a rizika zahrnují celý deklarovaný rozsah, nebo je limit jasně označen a starší položky dosažitelné.
- Skutečnost v kódu: `take: 100`, pořadí createdAt desc, následný součet pouze načtených kontextů. Starší aktivní zakázka nemusí být v přehledu ani KPI. Nebylo prokázáno, že konkrétní produkční tenant limit překračuje.
- Návrh: databázová agregace pro KPI + stránkovaný seznam, či výslovný popisek omezení jako dočasné opatření. Výkonnostní riziko `Promise.all` nad 100 kontexty změřit, netvrdit bez měření zpomalení.

## AUD-06 — P2: rozpracovaná mobilní fotografie není doloženě obnovitelná po reloadu

- **CODE_REVIEWED; UX scénář k ověření:** `components/navigation/MobilePhotoFieldAppView.tsx:145`, `:386–455`, přímý upload přes fetch. Soubor `File` je v React state; v této komponentě nebyla nalezena trvalá fronta ani beforeunload ochrana.
- Reprodukce k E2E: vybrat fotku, odpojit síť, pokusit upload, obnovit stránku. Zjistit, zda systém/browser zachová soubor nebo pouze zprávu o selhání. Není tvrzeno, že již úspěšně uložená fotka mizí.
- Očekávání: rozpracovaná fotka je obnovitelná nebo uživatel dostane jasné varování před opuštěním.
- Skutečnost dle životnosti stavu: po remountu se photoFile inicializuje na null. Telefon může mít originál v galerii, to však nenahrazuje stav přiřazení.
- Návrh: nejprve varování pro rozpracovaný upload a jednoznačný retry; offline frontu případně navrhnout zvlášť s idempotencí a ochranou soukromí. Akademie nesmí slibovat offline režim.

## AUD-07 — P2: tři podobně pojmenované terénní agendy

- **CODE_REVIEWED, UX hodnocení:** `lib/navigation.ts:36–37`, `app/mobile-photos/page.tsx`, `app/mobile-surveys/page.tsx:26`, `app/field-survey/page.tsx:23`.
- Reprodukce: uživatel s příslušnými moduly vidí „Terénní průzkum ploch“, „Průzkum lokalit“ a „Mobilní foto“. Úkol zní „vyfoť novou plochu“ bez upřesnění účelu.
- Očekávání: uživatel pozná, zda jde o stávající nosič, návrh navigace, nebo nový průzkumný bod.
- Skutečnost: názvy samy nevysvětlují odlišný životní cyklus ani kam se foto uloží; nejde o důkaz chybného ukládání.
- Návrh: doplnit popisky „Existující nosič“, „Průzkum navigace k nabídce/zakázce“, „Nová plocha – Field Survey“ a krátký rozcestník. Zachovat doménové oddělení.

## AUD-08 — P3: README odkazuje na jiné route než současný projekt

- **CODE_INDEXED:** `README.md` přehled modulů uvádí `/crm/clients`, `/crm/orders`, `/surfaces`, `/work-orders`, `/settlement`, `/invoices`; index page.tsx tyto samostatné stránky neobsahuje. `next.config.mjs` nemá nápravu přes redirects.
- Reprodukce: porovnat názvy s `route-index.md`; po přihlášení se v E2E pokusit otevřít uvedené adresy.
- Očekávání: dokumentace vede na existující UI.
- Skutečnost: nesoulad statických adres; některé domény existují jako API/záložky. Netvrzený HTTP status bez browseru.
- Návrh: aktualizovat popis podle registry skutečných stránek a zavést CI kontrolu vazeb lekcí na route.

## Omezení, která nejsou automaticky chyby

- B2B partnerství je ve `NetworkHubView.tsx:832` výslovně omezeno do implementace bezpečné perzistence. Neprezentovat celý modul jako hotovou síť.
- AI Planner se záměrně hlásí jako připravovaný. `/api/planner/settings` AI přepínače odmítá; netvořit funkční lekci pro neexistující schopnost.
- SEEPOINT_STORAGE adapter není hotový; platné podporované cesty v přečteném helperu jsou DATABASE a GOOGLE_DRIVE s volitelným DB fallbackem. Před videem ověřit konfiguraci, nikoli přepínat produkci.
- `lib/field-survey/data.ts` komentuje PostgreSQL RLS; nalezený mechanismus v `lib/db.ts` a `tenant-prisma.ts` je především Prisma query scoping. Samotný komentář není důkaz aktivních DB RLS politik. Ověření DB policy zůstává otevřené.
- Nebyla prokázána obecná funkčnost providerů AI, odesílání e-mailů, CÚZK, map ani Drive. Přítomnost kódu/API klíčů by ji sama neprokázala.

## Dosud neověřené, prioritní scénáře

| Oblast | Scénář | Přijímací podmínka |
|---|---|---|
| Navigace | dva cíle, každý tři body, klient vybere podmnožinu | finální zakázka obsahuje správné body, cíle i fotografie |
| Navigace | potvrdit opakovaně, změnit přijatou zakázku | jedna objednávka; řízený changeset, historie a správný downstream |
| Foto | Drive nedostupný, GPS zamítnuta, síť přerušena | srozumitelný stav; žádná tichá ztráta nebo duplicita |
| Storage | tenant B žádá soubor tenant A přes ID/token | žádná metadata ani bytes; platný veřejný přístup jen ke schváleným médiím |
| Field Survey | upload a smazání průzkumné fotky | nulový vedlejší zápis/mazání do Photo a galerie nosiče |
| Obsazenost | dvě současná přijetí překrývajících se kampaní | jedna úspěšná rezervace; druhá s vysvětlenou kolizí |
| Realizace | objednávka → výroba → instalace → photo → faktura | domény mají stejné reference a nevznikne dvojí fakturace |
| AI Inbox | opakované potvrzení a nižší role | doménová akce nejvýše jednou; nedovolená akce odmítnuta serverem |
| Mobil | 360 px, měkká klávesnice, povolení kamery/GPS, back | ovladatelné CTA, zachování rozpracované práce nebo varování |

Čísla řádků jsou orientační pro pracovní strom v době auditu. Nálezy nebyly automaticky opraveny; toto je analytická fáze dle zadání.
