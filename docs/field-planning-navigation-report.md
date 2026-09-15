# NavigationPoint → Field Planner

## 1. Stav před rozšířením

Field Planner již měl persistentní FieldPlan, tenantový profil, deterministický serverový engine, Google Routes s označeným odhadem, schválení v Serializable transakci, rezervace vozidel, audit, notifikace a mobilní `/my-route`. Navigation WorkOrder byl ale jedinou zastávkou. Více odlišných GPS v jedné zakázce se správně odmítalo jako nejednoznačná lokalita.

## 2. Co chybělo

Identita samostatného NavigationPointu v plánovacím vstupu, snapshotu a mobilních akcích. Audit také potvrdil, že NavigationOrder nemusí mít WorkOrder. NavigationPoint má GPS, adresu, instalátora, plánovaný čas, pořadí, stav a hlášení problému, ale nemá servisní dobu ani stav IN_PROGRESS. Jeho `routeDurationSeconds` je jízdní doba, nikoli délka montáže.

## 3. Znovupoužité části

Zůstal jediný `planning-engine`, FieldPlan, profil, mapa, `/work/route`, `/my-route`, vozidla a jejich canonical rezervace. Pokud existuje WorkOrder, schválení používá jeho WorkAssignment a `syncWorkOrderTasks`. U bodů bez WorkOrderu používá stávající `NavigationPoint.installerUserId`, `plannedInstallationAt` a `routeOrder`. Pomocné WorkOrdery ani WorkTasky se nevytvářejí.

`computeGoogleRoute()` zůstává silničním zdrojem doby jízdy. Nedostupná služba používá původní deterministický odhad a vyžaduje souhlas manažera. Nebyl přidán geocoding ani omezení na český region. Editor Navigation již umožňuje kliknutí na mapu a přesun bodu (`components/offers/NavigationPointMap.tsx`). Planner pouze spotřebovává existující GPS.

## 4. Databáze a konfigurace

Toto rozšíření nepřidává databázový model, field ani migraci. Používá JSON stávajícího FieldPlanu pro `jobId`, `sourceType`, `sourceId`, `navigationPointId`, `navigationOrderId`, volitelný rodičovský WorkOrder, klienta, číslo zakázky, adresu, GPS, ETA a délku práce. Starší WorkOrder snapshoty se stále čtou; při schvalování starého návrhu může změna kontraktu vyžadovat přepočet.

Existující tenantový profil dostává konfigurovatelnou položku `serviceMinutes.NAVIGATION_INSTALLATION` a volitelné `navigationPointMinutes` pro override konkrétního bodu. Hodnoty se validují a reference ověřují proti organizaci. Délka montáže není natvrdo nastavená; bez nastavení bod zůstane neplánovatelný. Produkční databáze ani deployment se nemění.

## 5. Více bodů jedné zakázky

Adaptér `navigation-jobs.ts` převádí každý vybraný bod na samostatný vstup stejného enginu. Pět různých GPS znamená pět zastávek, nikoli pět nových WorkOrderů. INSTALLED/CANCELLED body engine vynechá, chybějící GPS označí „Chybí GPS.“ a problém či nedokončené schválení bodu instalaci zablokuje. Připravenost respektuje instalační stav NavigationOrderu; původní PLANNED bod není uměle převáděn na jiný business stav.

## 6. Kombinování zakázek a schválení

Jedna sada vstupů může obsahovat běžné WorkOrdery a body několika NavigationOrderů. Engine zachovává priority, termíny, omezení posádek, absence a dostupnost vozidel. Nové body mají stabilní identitu `navigation-point:<id>`.

Manager filtruje typ práce a hledá klienta, číslo zakázky, město či adresu. Vidí připravenost, GPS, délku práce a termíny. Výběr má explicitní počet a možnost vybrat pouze zobrazené zastávky. Schválení znovu načte tenantové zdroje; změna GPS, stavu, instalátora, souvisejícího WorkOrderu nebo profilu vyžaduje nový návrh. Bod patřící jinému schválenému plánu není znovu přidělen.

## 7. Mobilní realizace

`/my-route` zobrazuje každou vlastní schválenou zastávku zvlášť, včetně pořadí, klienta, adresy, plánovaného času, poznámky určené klientovi a fotografie. DTO neobsahuje ceny, marži, interní CRM poznámky ani seznam pracovníků. Otevření bodu ukazuje jeho detail přímo na kartě, nikoli celou obchodní zakázku.

Pracovník naviguje, zahájí práci, nahraje fotografie před/po montáži, nahlásí problém a přejde na další bod. Po prvním dokončení z osmi vidí „1/8 hotovo“. Start je auditní událost; nevymýšlí nový stav NavigationPointu. Všechny mutace znovu ověřují vlastní posádku, platné přiřazení, organizaci a dnešní schválený plán.

## 8. Autoritativní Navigation workflow

Montáž stále dokončuje `attachPointInstallationPhotos()` v `lib/navigation/navigation-service.ts`. Existující native API i Field Planner nyní sdílejí validaci a ukládání přes `uploadInstallationPhotos()`. Field Planner volá stejnou instalační službu uvnitř své transakce. Fotografie končí ve stejném Photo modelu a úložišti, s původním propojením bodu, nosiče a plochy. Prázdný nepovinný soubor před montáží se bezpečně vynechá. Při selhání se uložené soubory uklidí.

Problém používá sdílené `reportNavigationPointIssue()` a původní `issueReported`, `issueType`, `issueNote`. Ovlivní jen zvolený bod; existující AI Realization jej dál vidí jako blocker. Oznámení managerovi zůstává v existujícím notification provideru. Audit zahrnuje vygenerování a schválení plánu s ID bodů, start, dokončení, problém i přepočet. Původní dokončený snapshot se nemaže; nová verze plánuje jen zbývající body.

## 9. Vznik nosiče

Generate, optimalizace, approve ani start nosič nevytvářejí. Nosič a plocha vznikají pouze ve stávající instalační službě při potvrzení skutečné montáže fotografií. Samotné tlačítko Dokončit instalaci bez fotografie neobejde. Fakturační readiness ani schvalování výkazů práce se nemění.

## 10. Ověření

Výchozí hlavní sada: **715 PASS / 0 FAIL / 2 SKIP**.

| Kontrola | PASS | FAIL | SKIP |
| --- | ---: | ---: | ---: |
| `npm test` (728 testů) | 725 | 0 | 3 |
| Nové Navigation jednotkové scénáře (součást `npm test`) | 10 | 0 | 0 |
| Navigation Postgres integrační testy | 10 | 0 | 0 |
| Původní Field Planner Postgres testy | 14 | 0 | 0 |
| Playwright / Chrome: Navigation a původní Work route | 2 | 0 | 0 |

Tři přeskočené testy v běžné sadě jsou opt-in databázové sady: původní Navigation conversion a obě Field Planner DB sady. Obě Field Planner sady byly navíc spuštěny samostatně proti izolované databázi a prošly. Statické photo-storage testy nyní sledují extrahovanou sdílenou službu včetně validace a cleanupu; nebyly odstraněny jejich bezpečnostní požadavky.

`npm run prisma:generate`: PASS. `npm run security:tenant`: PASS. `npm run typecheck`: **0 chyb, exit 0**. `npm run build`: **PASS, exit 0**, včetně produkční kompilace, kontroly typů a generování stránek. `git diff --check`: bez chyb whitespace.

Artefakty a logy jsou v `output/navigation-planner-*`. Databázové a prohlížečové testy jsou chráněny názvem i hostname izolované testovací větve a odmítají produkční endpoint. Prohlížeč ověřil manager → DRAFT → approve → worker → fotografie → 1/8 hotovo, přesný počet vzniklých nosičů, nulové pomocné WorkOrdery, odmítnutí jiného tenantu a nepovoleného worker approval, vypnutý modul, absenci chyb stránky a mobilní rozložení bez vodorovného přetékání.

### Omezení V1

- Zachovává původní limity enginu a celodenní rezervace vozidel. Neobsahuje GPS tracking ani nový optimizer.
- Body bez WorkOrderu nemají ve schématu vlastní prioritu; používají NORMAL a dostupné termíny Navigation/CRM. Pokud WorkOrder existuje, jeho priorita a omezení se dědí.
- Per-point override v této verzi upravuje délku práce; další pracovní omezení pocházejí z existujícího WorkOrderu a Navigation přiřazení.
- Schválený přepočet zachovává posádky a vyžaduje potvrzení jejich aktuálního výchozího bodu, stejně jako původní V1.
- Fotografie používají původní limit a podporované formáty. Kontrola kvality a fakturace zůstávají v Navigation / AI Realization.
