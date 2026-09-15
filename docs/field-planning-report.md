# AI Route & Field Planner — implementační report

Navazující rozšíření samostatných NavigationPointů je popsáno v [field-planning-navigation-report.md](field-planning-navigation-report.md). Odstraňuje níže uvedené původní omezení Navigation WorkOrderu na jedinou lokalitu; tento dokument zachovává záznam první implementace V1.

Rozšíření stávajícího `/work/route`. Provozní data mění pouze výslovné schválení manažera; plánovací engine nepoužívá LLM. Implementace a ověření proběhly v aktuálním projektu. Produkční databáze nebyla migrována ani nasazena.

## 1. Existing architecture audit

Podrobný audit je v [field-planning-audit.md](field-planning-audit.md). Znovu použity WorkOrder/WorkOrderItem, Employee/EmployeeAbsence, WorkAssignment → syncWorkOrderTasks → WorkTask, Vehicle/VehicleReservation, WorkEntry UI, Photo upload, CrmRealization a NavigationPoint. Nebyl vytvořen druhý Work, Employee, Vehicle, Photo ani realization systém.

## 2. Database changes

* `OrganizationFieldPlanningProfile`: jediný profil organizace, validované JSON nastavení. Obsahuje timezone, country, výjezd/návrat, pracovní dobu, přestávku, povolený přesčas, strategii, délky práce, maximální počet zastávek, potřebu vozidla, explicitní parametry nouzového odhadu, aktivaci a povinné schválení.
* `FieldPlan`: DRAFT/APPROVED/ACTIVE/COMPLETED/CANCELLED, datum, verze, tvůrce/schvalovatel, vstupní a výsledný snapshot, původ přepočtu a vytvořené rezervace. Unikátní `(organizationId,date,version)` a `(organizationId,requestKey)`. Crews/stops jsou součástí neměnného snapshotu, nikoli alternativní business entity.
* `WorkOrder.planningConstraints`: časová okna, požadovaní zaměstnanci/pozice, předchůdci a potřeba vozidla. Délka konkrétní práce nadále používá existující `estimatedHours`.
* Migrace `20260914090000_field_planning` úspěšně aplikována pouze na testovací větev.

## 3. Planning engine

`lib/field-planning/planning-engine.ts`: deterministická serverová heuristika. Ověřuje tenanty a reference, dostupnost posádek, vozidel, povinné pracovníky/pozice, pořadí, časová okna, termíny, službu, přestávku a návrat do konce směny. Pevné termíny předcházejí prioritě; následně používá geografickou blízkost a vyhodnocení proveditelných posádek. Strategie BALANCED zohledňuje vytížení, DISTANCE délku přejezdů. Výstup má ETA, čekání vyjádřené rozdílem arrival/start, servisní a cestovní čas, návrat, konflikty a nepřiřazenou práci. TravelProvider lze vyměnit bez změn doménového modelu.

## 4. Google Routes

Každý kandidátní přejezd a návrat používá existující `computeGoogleRoute()`, s cache po dobu výpočtu. Helper nově omezuje čekání na externí odpověď na osm sekund. Při nedostupnosti se použije deterministický odhad z GPS, tenantového koeficientu vzdálenosti a zadané rychlosti. Odhad je označen v mapě, metrikách a vysvětlení; schválení vyžaduje zvláštní potvrzení odhadovaných přejezdů. Region není omezen na CZ; V1 používá již známé souřadnice, nikoli nový geocoder.

## 5. Worker availability

Employee.isActive, role/roles, position/positions, datum začátku/konce zaměstnání a schválené EmployeeAbsence. Absence respektují existující inkluzivní kalendářní dny. Jiné úkoly a schválené plány blokují pracovníka pro daný den. Dostupnost a požadované pozice se kontrolují znovu při schválení. Žádný nový HR/skills systém.

## 6. Vehicles

AVAILABLE/RESERVED se posuzují společně s konkrétními rezervacemi; SERVICE/OUT_OF_SERVICE/IN_USE nejsou při novém plánování dostupné. Jedno vozidlo nelze použít dvěma posádkám. Extrahovaná `vehicle-reservation-service.ts` sdílí tvorbu rezervace a `derivedVehicleStatus` se stávajícím vozidlovým API. Zachována celodenní granularita a Serializable kontrola překryvu. Přepočet může znovu použít pouze ověřené vlastní rezervace předchozího plánu.

## 7. Draft & approval

Generate vytváří jen DRAFT. Manager vidí počty, km, časy, konflikty, nepřiřazené úkoly a rizika termínů. Schválení odmítá konflikty, nepřiřazenou práci, prošlý odjezd, změněnou zakázku/profil a neaktuální dostupnost/kvalifikaci. Změna vstupů v UI vyžaduje přepočet. Serializable transakce s retry, unikátní request klíče, stabilní ID assignmentů/rezervací a podmíněný přechod DRAFT zabraňují duplicitám. JSONB fingerprint je nezávislý na pořadí klíčů. Selhání operace vrací celou transakci zpět.

## 8. /work/route

Datum a volitelný nejdřívější odjezd; výběr úkolů; editace délky a časových/provozních omezení; sestavení vícemístných posádek z Employee; výběr vozidel; dostupnost; barevné trasy; pořadová čísla; aktivní posádka; souhrny a verzované návrhy. Mapa zůstává Leaflet. Google Maps odkazy se dělí na označené části bez vynechání pozdějších zastávek. Na menších displejích se panely řadí pod sebe.

## 9. Mobile route

`/my-route`, dostupné také z `/my-tasks`: pouze vlastní schválené zastávky pro dnešní tenantový den. Karty obsahují klienta, pracovní instrukce, nosič/adresu, odkaz na náhled, plánovaný čas a navigaci. Zahájit/Dokončit mění skutečný WorkOrder a WorkTask. Vykázat práci otevírá existující `/my-work-entries?taskId=…`. Nahrát fotku používá původní CarrierPhotoUploadModal. Navigation má odkaz do autoritativního bodového workflow. Dokončení nevytváří automaticky schválený výkaz, nenastavuje ftdSent a neoznačuje realizaci za připravenou k fakturaci.

## 10. Replanning

Přepočet vytváří novou verzi DRAFT ze stejného seznamu zakázek; DONE/CANCELLED se znovu neplánují. Původní plán zůstává účinný do schválení nové verze. Schválený přepočet zachovává lidi a vozidla a vyžaduje manažerem potvrzené aktuální GPS výjezdu. Nahrazení předchozího plánu je auditované a využívá původní rezervace. Historie skutečně dokončené práce se nemění.

## 11. AI

V1 obsahuje deterministické české vysvětlení a vysvětlení jednotlivých zastávek. LLM/Gemini se nepoužívá pro optimalizaci ani pro mutace. Nedostupnost generativní AI proto neovlivňuje plánování.

## 12. Tenant security

Nové modely jsou v tenantovém registru. Stránky a API po autentizaci explicitně předávají aktivní tenantový kontext. Služby validují WorkOrder, Employee, Vehicle, rezervace a související CRM/Navigation/carrier reference. Worker DTO neobsahuje cenu, marži, interní CRM poznámky, kontakty klienta ani ID jiných zaměstnanců. Testy ověřují cizí reference i čtení/schválení/zrušení/přepočet cizího plánu.

## 13. Permissions

Existující `workRoute` module gate a module-policy kontrolují plán organizace a enabledModules i u přímého API requestu. Generate, konfigurace, změny omezení, approve a cancel vyžadují ADMIN/MANAGER. Worker/Technician má pouze vlastní schválenou trasu a vlastní přiřazenou práci. Nebyl vytvořen paralelní RBAC engine.

## 14. Audit

Existující CrmAuditLog eviduje konfiguraci, omezení, generování, přepočet, schválení, zrušení, zahájení/dokončení, problém a jeho vyřešení. WorkOrder/Realization/Navigation business data se při problému nemažou. Standardní realizace dostává claimNote; NavigationPoint issueReported/issueType/issueNote. Samostatná WorkOrder má malý auditovaný blocker s manažerským potvrzením vyřešení.

## 15. Notifications

Přidán provider do existující notifications-service. Manažer vidí konflikty, nepřiřazenou práci, termínová rizika a hlášené problémy. Worker dostává informaci o schválené trase. Identifikátory jsou stabilní a tenantové; nejde o novou notifikační databázi, Control Tower ani push službu. AI Realization již čte claimNote a issueReported, takže pro tyto blockery nebylo nutné duplikovat insight architekturu.

## 16. Tests

| Sada | PASS | FAIL | SKIP |
|---|---:|---:|---:|
| Původní baseline | 686 | 0 | 1 |
| Finální `npm test` | 715 | 0 | 2 |
| Nový deterministický engine samostatně | 29 | 0 | 0 |
| Skutečný PostgreSQL, izolovaná větev | 14 | 0 | 0 |
| Chrome desktop + mobilní end-to-end | 1 | 0 | 0 |

Engine testy jsou již zahrnuty v `npm test`; nesčítat je podruhé. Druhý skip v běžné sadě je úmyslně oddělená PostgreSQL sada, která v samostatném běhu prošla. DB testy zahrnují dva souběžné generate, dva approve stejného plánu, dva konkurující plány, změnu kvalifikace, izolaci tenantů, vlastní worker DTO, idempotentní dokončení, replanning, problém a authoritative Navigation. Browser test ověřil skutečný tok UI → API → DB → mobil, zákaz worker approval, cizí tenant a vypnutý modul, bez pageerror a bez horizontálního přetékání mobilu.

## 17. TypeScript

`npm run typecheck`: 0 errors. Tenant security guard: PASS. `git diff --check`: bez chyb whitespace.

## 18. Production build

Závěrečný `npm run build`: PASS, exit code 0. Úspěšná kompilace, kontrola typů a generování všech 105 statických stránek. Doloženo logem `output/field-planner-build.log`. Build není nasazení ani migrace produkční databáze.

## 19. Known limitations

* V1 je heuristika, nikoli globálně optimální VRP solver. Jedna WorkOrder musí označovat jednu jednoznačnou pracovní lokalitu; více odlišných lokalit se označí jako neplánovatelné a musí se rozdělit současným Work workflow.
* Rezervace a blokace pracovníků jinou prací jsou konzervativně po dnech; přestávka je souvisle před návratem. Individuální směny a více přestávek nejsou modelovány.
* Stávající Google helper poskytuje traffic-unaware jízdní časy. Fallback je explicitní odhad, nikoli záruka průjezdnosti silnice. Žádné nové geocoding omezení na CZ.
* Replanning během dne zachovává posádky/vozidla; nemá GPS tracking ani automatický odhad aktuální polohy či již odpracované části služby. Zbylou délku práce může upravit manažer.
* V1 limituje jeden požadavek na 200 WorkOrderů a 30 posádek. Konfigurace profilu je nutná před prvním použitím; pracovní doba ani servisní časy nejsou doplněny firemními konstantami.
* Fotografie a Navigation akce respektují oprávnění svých existujících modulů. Billing readiness nadále řídí AI Realization a jeho pravidla validních fotografií. Starý mobilní `/work-orders/[id]/status` endpoint nebyl globálně přepsán; nová trasa nepoužívá jeho FTD/payroll shortcut.
* Původní zobrazovací jména v WorkAssignment zůstávají podporována, nejednoznačné vazby se odmítají. Stabilní uživatelské ID má v synchronizaci přednost.
* Produkční migrace/deployment nejsou součástí provedených změn. Před nasazením nové aplikace je nutné aplikovat přiloženou migraci.

## 20. Recommended V2

Rozšířit optimizer o vkládání zastávek a lokální optimalizaci, časově přesné sdílení kapacity pracovníků, individuální směny/přestávky, tenantové equipment capabilities a optimalizaci více lokalit jedné WorkOrder bez narušení kanonického dokončování. Doplnit bezpečné plánované předání posádky/vozidla během dne, cache road matrix, traffic-aware režim existujícího Google helperu, offline mobilní frontu a lepší předvýběr bodu/fototypu ve stávajícím uploadu. LLM lze volitelně přidat pouze pro slovní vysvětlení.

## Ověřovací prostředí a artefakty

* Neon project: `royal-hat-94187799`, pouze testovací větev `codex-field-planner-20260914` (`br-broad-snow-atllvanj`). Obsahuje oddělené testovací tenanty a je ponechána pro review; compute má auto-suspend.
* `.env.field-planner.local` je ignorovaný lokální soubor s přístupem pouze k testovací větvi; není součástí změn pro commit.
* Logy: `output/field-planner-{all-tests,engine-tests,db-tests,browser-tests,types,tenant,migration,build}.log`.
* Screenshoty: `output/field-planner-desktop.png`, `output/field-planner-mobile.png`.

Reprodukce lokálních kontrol:

```powershell
npm run prisma:generate
npm run typecheck
npm run security:tenant
npm test
node --env-file=.env.field-planner.local --import tsx --test tests/field-planning-db.test.ts
npm run build
```

Databázová sada má výslovnou pojistku konkrétní testovací větve. Browser test je v `e2e/field-planning.spec.ts`; používá lokální server na portu 3107, Chrome a stejnou izolovanou databázi. Nové účty a tenanty si vytváří sám. Při ověřování byla nalezena a opravena ztráta AsyncLocalStorage kontextu po serverové autentizaci; finální browser test ověřuje již opravenou cestu.
