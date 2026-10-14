# Terénní práce — implementace, ověření a bezpečný rollout

Větev `feat/field-work`, základ `8fde0bb`, kontrola 13. 10. 2026. Neproběhlo nasazení, sloučení PR ani migrace nad externí databází. Výchozí nálezy a rozhodnutí o modelech: [audit](field-work-audit.md).

## Ověřitelné etapy a přehled změn pro revizi

| Etapa | Implementace |
|---|---|
| A — audit | Znovu ověřeno všech 12 původních nálezů. Zachováno FieldPlan, sdílený engine a Moje trasa. Field Survey zůstává samostatný. |
| B — opravy | Souběžné výjezdy stejné akce; odstranění deduplikace podle kampaně; samostatná kontrola kapacity jednoho úkolu; zahrnutí poslední vykládky, návratu a přestávky; navigace po úsecích. |
| C — zadání | Strukturovaná operace, objekt, manipulace, množství, časové okno, termín, GPS, podklad a požadavky. Nosič/plocha jsou volitelné a kontrolované v tenantovi. Staré body vyžadují kontrolu. |
| D — doprava a výjezdy | Navázané kroky vyzvednutí/doručení, průběžné zatížení; přesun v jedné posádce; explicitní předání; serverový draft a kontrola čerstvosti při schválení; nahrazení pouze parentPlanId stavem SUPERSEDED. |
| E — realizace | Nové zadání na detailu akce, hromadné změny, společná mobilní mapa, instrukce, množství, fotky kroků, problém, příjemce materiálu. Obě stavová API používají executeStop → executeFieldStep. |
| F — ověření | Regresní testy reálných funkcí, test HTTP založení, skutečná SQL migrace v PGlite, samostatný opt-in test skutečného PostgreSQL. Výsledky níže. |

Doporučené pořadí revize: `prisma/schema.prisma` a migrační SQL → `task-spec.ts`, `tasks.ts` → `planning-engine.ts`, `approval.ts`, `availability.ts` → `step-execution.ts`, `photo-upload.ts`, `execution.ts` → HTTP endpointy → `FieldWorkDesk.tsx`, `ElectionRoutePlanner.tsx`, `MyRouteView.tsx` → testy.

## Výsledný průchod

1. V **Terénní práce** založit akci: název, klient/interní účel, termín a společné instrukce. Existující KML/KMZ import vytváří samostatné body k ověření; při stejné GPS se neztrácejí média ani množství.
2. Na detailu vybrat nosič/plochu, nebo zadat samostatný objekt mapou či vyhledáním adresy. Potvrdit GPS. Samostatná instalace nemá povinný carrierId a nevytváří AdvertisingCarrier.
3. Vybrat jednu z devíti operací, množství, manipulaci a přesné instrukce. OTHER vyžaduje popis. Pro transport zadat pojmenovaný cíl, potvrzenou GPS, kapacitu nákladu a čas práce v cíli. Lze zadat kontakty, přístup, HTTP(S) podklad, vybavení, počet lidí, jejich pozice, termín a časové okno. Prázdný čas práce použije výchozí dobu podle operace, média a množství; ruční čas je celkový pro zadané množství.
4. Vybrat práce, datum, posádky a konkrétní vozidlo. U přepravy musí mít vozidlo potvrzenou kapacitu. Režim oddělených médií nebo společných tras. Nastavené depo musí být skutečné, nelze plánovat s fiktivním výchozím depem.
5. Zkontrolovat mapu, doby, kapacity a důvody nenaplánování. Schválení používá uložený serverový draft, nikoli dodaný klientský výsledek. Změna práce, přiřazení, profilu či dostupnosti vyvolá konflikt a nový přepočet. Duplicitní schválení stejného draftu vrací stejný plán.
6. Pracovník otevře **Moje trasa** (`/my-route`): společná mapa a zastávky všech jeho platných výjezdů. Navigace vede z aktuální polohy na další zastávku; celá trasa má očíslované úseky bez tichého vynechání bodů. Zahájit krok, nahrát fotografii, uvést provedené množství a dokončit. Zbytek je stále IN_PROGRESS. Při problému uvést skutečnou polohu a držitele materiálu.
7. Vyzvednutí nedokončuje převoz. Doručení vyžaduje dokončeného předchůdce a potvrzení místa uložení/příjemce. Změna posádky již naloženého materiálu vede přes explicitní krok HANDOFF s GPS, pokynem a fotografií převzetí.

Příklad: **REPLACE_AD + BENCH + 2 + LEAVE** znamená výměnu reklamy a ponechání konstrukce. Odvoz starého reklamního materiálu lze zadat WAREHOUSE s konkrétním cílem, kapacitou a instrukcí, že konstrukce zůstává. **REMOVE_OBJECT + BENCH + WAREHOUSE** představuje demontáž a odvoz samotné lavičky.

## Modely a invarianty

- ElectionCampaign zůstává kompatibilní akcí, doplněn clientName. ElectionRemovalPoint zůstává úkolem a snapshotem objektu; původní ID, popis a fotografie zůstávají.
- Nové údaje úkolu: operationType, objectType, materialDisposition/materialInstructions, carrierId/surfaceId, destinationName/GPS, referenceUrl, contact/accessInstructions, requiredWorkers/Positions/Equipment, loadSlots, reviewRequired, deadlineAt, windowStart/windowEnd.
- FieldWorkStep je chybějící realizační vrstva: pořadí, místo, délka, požadované/provedené množství, stav, změna nákladu, povinná fáze fotografie, aktuální plán/posádka, verze pro CAS, problém a custodyNote.
- Photo dostává volitelný fieldWorkStepId. Stávající vazba electionRemovalPointId zůstává. Složené FK s organizationId chrání vazby krok–úkol a fotografie–krok. Nové CHECK constraints chrání množství, GPS, délku a stavy.
- Vehicle dostává capacitySlots a equipment. FieldPlanStatus dostává SUPERSEDED. Vazba parentPlanId již existovala.
- Schválení a dokončení běží přes existující SERIALIZABLE transakci s retry. Přidělení a změna kroku navíc používají podmíněný updateMany, verzi a aktuální plan/crew. Audit dokončení má unikátní idempotentní ID a otisk obsahu požadavku.
- Aktuální přiřazení se ověřuje při každé realizaci a uploadu. Původní posádka nemůže dokončit přesunutý krok ani přes starý odkaz. Oprávnění plánovat mají ADMIN/MANAGER, provádět pouze aktuální člen přidělené posádky s realizační rolí.
- Dokončení terénního kroku nevytváří fakturu, mzdu, WorkEntry ani CRM realizaci. Existující realizace WorkOrder a Navigation využívají své dosavadní doménové větve.

## Převod a kompatibilita

Migrace: `prisma/migrations/20261012150000_field_work_steps/migration.sql`. Je aditivní. Žádný původní sloupec se nemaže, popisy se nepřepisují, fotografie se nepřevazují a historické stavy se neotevírají.

SQL přenese pouze explicitní staré značky operací, a to jen do dosud NULL operationType. Samostatné opakování části UPDATE je idempotentní. Všechny původní body mají reviewRequired=true, protože značka operace sama nepotvrzuje manipulaci ani GPS cíle. Běžný provoz nepoužívá parsování popisu. Heuristika zůstává pouze v importu a read-only klasifikačním reportu jako návrh.

Read-only report: `node node_modules/tsx/dist/cli.mjs scripts/review-field-work-legacy.ts ORGANIZATION_ID` s explicitním připojením do ověřené testovací kopie. Skript sám nenačítá .env a nic nezapisuje. U uzavřených bodů je reviewRequired pouze migrační údaj; UI je stále zobrazuje jako hotové.

Dispečer musí otevřené staré body jednotlivě ověřit, potvrdit operaci, GPS a manipulaci. Kontrola neodstartovaného legacy bodu zruší jeho staré přiřazení a vytvoří kroky. Potom reviduje explicitně původní výjezd; tím se uvolní jen jeho rezervace. Zahájené a dokončené historické práce se automaticky nepřevádějí na nové zadání. Historické nesprávně ukončené plány migrace sama nereaktivuje.

Původní URL akcí zůstávají. Starý mobilní route odkaz vede do společné Moje trasa. Staré klientské API bez konkrétního stepId/requestKey nemůže bezpečně zapisovat a vrací vysvětlený konflikt; neodhaduje následující krok. Původní API hromadného přepisování posádky je nahrazeno odkazem na revizi konkrétního výjezdu. Archivace akce zachovává historii a je odmítnuta při aktivních výjezdech.

## Ověření

Původní širší regrese: **289 testů, 284 prošlo, 5 přeskočeno, 0 selhání**. Následný cílený test `field-work-upload.test.ts`: **1/1 prošel**. Typová kontrola `tsc --noEmit`: **exit 0**. Cílený ESLint nových služeb, HTTP endpointů a hlavních změněných komponent: **exit 0, bez nálezů**. `scripts/check-tenant-security.mjs`: **OK**. `git diff --check`: **bez chyb**. **Produkční build `npm run build`: exit 0**, kompilace i typová kontrola úspěšná, vygenerováno 132/132 statických stránek. Během buildu byly všechny používané databázové URL explicitně nastaveny na lokální testovací adresu; žádná externí migrace ani nasazení neproběhly.

Následná regrese po browserem nalezené opravě tenant kontextu: **170 testů, 166 prošlo, 4 přeskočeno, 0 selhání** (`tmp/field-work-regression-verified.log`). Cílený lint všech election-removal endpointů, změněných obrazovek a nového browserového testu: **exit 0**. Opakovaná kontrola tenant pravidel: **OK**.

- `field-work-plans.test.ts`: skutečné approveFieldDraft a myRoute s náhradou persistence; dvě trasy jedné akce, idempotentní schválení, revize pouze rodiče, zastaralý úkol a cizí tenant.
- `field-work.test.ts`: skutečný parser, adaptér/engine, všech devět operací včetně OTHER, nezávislý objekt, 60/30 slotů, dvojice kroků a průběžný náklad, shodná GPS, režimy, poslední vykládka/přestávka/návrat a 12 navigačních bodů.
- `field-work-execution.test.ts` a `election-removal-execution.test.ts`: skutečné realizační služby; dílčí množství, opakování, konflikt CAS, změněné přiřazení, předchůdce, příjemce a statistiky.
- `field-work-api.test.ts`: skutečný HTTP handler a saveFieldTask; nahrazené pouze ověření identity a persistence. Samostatná instalace bez nosiče, tenant, oprávnění a GPS.
- `field-work-upload.test.ts`: skutečné uploadFieldPhoto a executeStop; náhrada persistence a storage provideru. Správný krok/fáze, opakování bez druhého uložení a odmítnutí starého přiřazení před uploadem.
- `field-work-migration.test.ts`: skutečné migrační SQL na lokálním PGlite; zachování původních fotografií/stavu, opakované mapování a odmítnutí cizího tenanta.
- Regrese zahrnuje Field Survey, sdílený planner, navigace, upload/fotografie, rezervace a tenant policy. Původní testové kopie implementace dokončování byly nahrazeny voláním produkčních služeb.

`field-work-db.test.ts`: **1/1 prošel na skutečném PostgreSQL 17** v izolované Neon větvi `br-restless-base-as6yz12i`, nové prázdné databázi `seepoint_field_work_test`, schématu `field_work_verified`. Ověřil skutečné vytvoření samostatného objektu, paralelní schválení jediného výjezdu, přidělení do Moje trasa, fotografickou vazbu, souběžné opakování dílčího i finálního dokončení, přesné statistiky a nulové finanční zápisy. Rozšířený průchod také ověřil skutečné schválení přesunu, odmítnutí doručení před vyzvednutím, nedokončení úkolu pouhou nakládkou, držitele materiálu, problém v cíli a dokončení až po potvrzeném převzetí. Test má pojistku pro lokální testovací DB nebo přesný izolovaný host/databázi/schéma. Spouštěč `scripts/field-work-verify.mjs` přepisuje všechny databázové URL pro potomky a zakazuje jiný host; připojení čte z ignorovaného `tmp/field-work-test-url.txt`, nikdy jej nevypisuje. Větev má expiraci 16. 10. 2026 v 18:00 UTC; původní databáze větve nebyla použita. Log: `tmp/field-work-db-verified.log`.

**Potvrzený problém starší migrační historie:** standardní `prisma migrate deploy` na nové prázdné DB selže už na `20260703093000_add_work_priority_and_price` (WorkOrder ještě neexistuje). Historické migrace nebyly měněny. Pro ověření nové migrace bylo v odděleném schématu vytvořeno výchozí schéma z `HEAD:prisma/schema.prisma` přes `prisma migrate diff --from-empty`, poté aplikováno skutečné nové migrační SQL. Oba kroky prošly. To ověřuje nový rozdíl schématu, nikoli kompletní bootstrap historických migrací. Před produkční migrací je nutné porovnat skutečnou migrační historii konkrétní DB; tento test neopravňuje k automatickému baseliningu produkce.

**Chyba nalezená prohlížečem a opravená:** asynchronní guard sám spolehlivě nepředává AsyncLocalStorage kontext zpět HTTP handleru. Handlery election-removal nyní nastavují ověřený tenant kontext přímo po autentizaci, stejně jako stávající společná realizační API. Regresní HTTP test už si kontext nepřipravuje za aplikaci.

Založení akce nově používá sdílený plannerTransaction (SERIALIZABLE, 30 s, retry konfliktů), neprovádí createMany pro prázdný import a v téže transakci ukládá FIELD_ACTION_CREATED. Browser zachytil P2028 (neplatná/ukončená transakce) při založení akce; původní krátká transakce byla nahrazena stejným nastavením jako ostatní plánovací zápisy. Skutečný HTTP handler je pokryt `field-work-action-api.test.ts`: **1/1 prošel**, včetně auditu a odmítnutí pracovníka.

### Přihlášené mobilní ověření (14. 10. 2026)

`e2e/field-work.spec.ts` prošel v Chrome nad lokálním produkčním buildem a izolovanou DB. Finální průchod trval 35,8 s (celkem 42,6 s), bez chyb. Skutečné relace managera a pracovníka ověřily: založení akce, samostatný objekt z bodu v mapě bez carrierId, operaci a množství, serverový návrh/schválení, přidělení v mobilní mapě, zahájení, skutečný upload a načtení fotografie s vazbou ke kroku/fázi AFTER_INSTALLATION, částečné a konečné dokončení i nulové automatické nosiče/finanční zápisy. Ověřil také audit založení akce, odmítnutí pracovníka při zadávání (403) a pokusu manažera zapisovat do cizí akce (409, žádný vytvořený bod). Mobilní šířka 390 px nemá horizontální přetékání. Snímky čekají na viditelné Provedeno 1 z 2 a po finálním dokončení na skrytí hotové práce; oba snímky byly vizuálně zkontrolovány. Test nepoužívá napodobeniny API ani databáze; seeduje pouze nové účty, relace a prostředky testovací organizace.

Závěrečný build po všech opravách: **exit 0**, včetně celoprojektové typové kontroly a 132/132 statických stránek (`tmp/field-work-build-verified.log`). Cílený lint posledních změn: **exit 0, bez nálezů**. Lokální testovací server byl po ověření zastaven.

Důkazy: `tmp/field-work-browser-verified.log`, `output/field-work-desktop.png`, `output/field-work-mobile-partial.png`, `output/field-work-mobile-done.png`. Testovací snímky a logy jsou lokální, mimo verzovaný kód.

Dodatečně opraveny dvě chyby:
- Mobilní Dnes/Zítra používalo UTC místo pásma organizace. Používá nyní stejný dayInZone jako server a obnovuje den během otevřené stránky.
- Adaptér přesunu předával do delivery.location celý FieldWorkStep včetně Date. Po databázové JSON serializaci to měnilo hash a schválení odmítalo platný přesun. Cíl nyní obsahuje pouze souřadnice; změny kroku jsou již zahrnuté v updatedAt. Nový test ověřuje shodu hash před/po JSON převodu. Cílená regrese: **11/11 prošlo** (`tmp/field-work-transport-regression.log`).

## Bezpečný postup nasazení

1. Zajistit zálohu a izolovanou testovací kopii databáze včetně fotografických vazeb. Zaznamenat počty kampaní, bodů, dokončených bodů a fotografií po organizacích. Nezahrnovat produkční tajemství do testovacích logů.
2. V ověřené kopii aplikovat migrace standardním `prisma migrate deploy`; nepoužívat reset ani db push. Ověřit počty, FK, staré fotografie, read-only klasifikační report a historie hotových akcí.
3. Spustit typovou kontrolu, relevantní testy, build a skutečné databázové testy. V lokální databázi s výše uvedenou pojistkou spustit field-work-db.test.ts. Ta vytváří izolovaná data s náhodnými názvy; databázi po testu ponechá k inspekci.
4. Na schváleném preview přihlásit managera a dva pracovníky. V mobilní šířce 390 px projít samostatnou instalaci, výměnu reklamy s odvozem materiálu, přesun A→B, problém v cíli, explicitní předání, dvě média ve dvou výjezdech, 1/2 + retry, odmítnutí starého odkazu a výpadek sítě během uploadu. Ověřit i běžnou Navigation a WorkOrder realizaci.
5. Před pilotem potvrdit zapnutí modulů Terénní práce a workRoute pro společnou realizační obrazovku, skutečné depo, kapacity vozidel, vybavení, pozice a vybrané otevřené legacy práce. Nevydávat neověřené importy pracovníkům. Označení odhadovaných přejezdů zůstává v engine výsledku, pokud chybí silniční provider.
6. Produkční migraci a nasazení provést až po samostatném výslovném pokynu. Monitorovat konflikty schválení, uploady, opakování, rozpracované kroky a rozdíl mezi dokončením práce a dopravy.

## Návrat

Po přidání sloupců není nutné schéma vracet. Při problému pozastavit nové plánování/realizaci tohoto modulu, ponechat fotografie a audit a nasadit opravenou kompatibilní verzi. Starý kód znovu parsující description nesmí zapisovat do nových strukturovaných prací. Pro úplný návrat staré aplikace je nutná uzávěra zápisů a ochrana tohoto modulu proti zápisu, případně schválená obnova celé zálohy včetně vědomého řešení nových dokončení/fotografií. Žádný automatický destruktivní down.sql se nedodává. Nové sloupce, kroky a fotografie se nemažou, dokud není převod a návrat ověřený.

## Zbývající omezení a neověřené části

- Přihlášený browserový průchod pokrývá samostatnou instalaci, fotografii a dílčí dokončení. Přesun je ověřen skutečnými doménovými službami na PostgreSQL; všechny kombinace operací, importu, předání a stávajících Navigation/WorkOrder nebyly jednotlivě proklikány v browseru. Silniční API nebylo voláno; plán používal označené odhadované přejezdy.
- Revize nahrazuje neodstartovaný výjezd v témže dni. Automatické přeložení již zahájené práce na jiný den není implementováno.
- Dostupnost konzervativně blokuje celý plánovací den; nezavádí automatické opakované směny stejné posádky v témže dni. Konflikty s aktivními výjezdy přesahujícími den se také kontrolují.
- Transport je sousední dvojice vyzvednutí/doručení, nikoli obecný optimalizátor mnoha vzájemně prokládaných převozů. To bezpečně drží náklad, posádku a pořadí.
- Předání podporuje celý naložený materiál před zahájením doručení. Částečně doručený náklad automaticky nerozděluje. Zahájené práce chrání proti běžnému přepsání/revizi.
- Nadměrný úkol se automaticky nedělí, protože zadání neprokazuje fyzickou dělitelnost. Konkrétní konflikt vyžaduje větší vozidlo nebo explicitní samostatná zadání dispečerem.
- Materiál má provozní historii a držitele, nikoli účetní skladové pohyby. Referenční podklady se zadávají URL; realizační fotografie používají existující tenant storage.
- Retry formuláře drží stav v otevřené stránce; nejde o plnou offline aplikaci s perzistentní frontou po restartu prohlížeče.
- Nové práce mají fotografickou fázi podle operace (AFTER_INSTALLATION / AFTER_DEINSTALLATION / CONTROL); není přidán samostatný administrační editor fotografických politik.
- KML/KMZ import je zachován jako založení akce s body k ověření; dodatečné připojení dalšího KML do již existující akce není nově implementováno.

## Předprodukční ověření 15. 10. 2026

Uživatel autorizoval sloučení a produkční nasazení. Produkční Neon projekt je `royal-hat-94187799`, větev `br-super-boat-at3cgqf3` (potvrzeno i historií předchozích nasazení). Nová izolovaná kopie `br-bold-hall-atbtwayw` má expiraci 22. 10. 2026 22:00 UTC. Standardní `prisma migrate deploy` na této kopii úspěšně aplikovalo čekající `20261009010000_academy_foundation` z main a `20261012150000_field_work_steps`. Žádný reset ani přepis historických migračních záznamů neproběhl.

Před i po: 9 kampaní, 250 bodů, 961 fotografií, 29 plánů; stejný kontrolní součet původních popisů/stavů bodů i fotografických vazeb. Historie měla 68 záznamů, poté 70, žádná nedokončená migrace. Starší historie obsahuje odlišné checksumy a duplicitní historický záznam; zůstala nedotčená. Není to doklad čistého bootstrapu starých migrací.

Před produkční změnou vytvořen recovery snapshot `snap-plain-sea-atzql440`, expirace 29. 10. 2026 22:00 UTC. Opraveny dvě testovací fixture nalezené CI: explicitní typování částečného transportního objektu a pevný čas u realizačního testu (UTC datum kolem pražské půlnoci). Produkční logika se těmito opravami nemění. Lokální plná typová kontrola i cílené testy prošly. Stav samotného nasazení viz PR #417 a jeho deploy.
