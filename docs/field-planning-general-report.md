# Obecný Field Operations Planner — implementační report

Datum: 15. 9. 2026. Navazuje na existující Field Planner a jeho Navigation adaptér.

## 1. Audit
Plánovač již používal WorkOrder, Employee, Vehicle, VehicleReservation, FieldPlan, tenantový provozní profil a Google Routes. Rozpad do více zastávek byl dostupný pouze pro NavigationPoint. WorkOrderItem neměl vlastní realizaci ani vazbu na dokladovou fotografii. AdvertisingSurface nemá vlastní GPS; používá nosič. Běžná editace zakázky mazala a znovu vytvářela položky.

Výchozí testy: 725 PASS, 0 FAIL, 3 SKIP. Podrobnosti: `field-planning-general-audit.md`.

## 2. Zdroje zastávek
Podporovány jsou původní jednoduchý WorkOrder, pracovní položka WorkOrderItem a NavigationPoint. Navigační zakázka nadále používá autoritativní Navigation workflow. CRM realizace se váže na konkrétní pracovní položku, netvoří duplicitní zastávku.

## 3. Rozpad více lokalit
Vícepoložková práce vytváří zastávky `work-item:<id>`. Nové položky, položky s plochou nebo CRM vazbou používají individuální realizaci. Starší jednoduché práce zachovávají kompatibilní WorkOrder identitu. Identitou není GPS: různé položky na stejných souřadnicích zůstávají samostatné. `quantity` znamená kusy v jedné práci, nikoli vymyšlené lokality. Chybějící GPS zůstává neplánovatelné.

## 4. Kanonické dokončení
Samostatná položka má vlastní průběh. Propojená CRM položka čte stav z CrmRealization; zahájení a dokončení mění existující realizaci. Propojení je povoleno pro instalaci a reinstalaci. Dokončení jednoho bodu nedokončí sourozence. WorkOrder a související WorkTask jsou hotové až po dokončení nebo zrušení všech relevantních položek bez problému. Nevzniká automaticky schválený WorkEntry, FTD ani billing readiness.

## 5. Fotografie a problémy
Používá se existující Photo a společná validace/úložiště mobilních fotografií. Doklad má přesné workOrderItemId a případně crmRealizationId, carrierId a surfaceId. Dokončení vyžaduje doklad konkrétní položky. Provozní problém blokuje právě tuto položku; u propojené realizace používá její claimNote. Manažer řeší problém z detailu práce. Formální CRM reklamace se nepřepisuje z tohoto editoru. Dokladové fotografie nelze smazat běžným endpointem pro mazání fotografií.

## 6. Organizace bez Navigace
Server čte dostupnost z existující organization/module policy. Vypnutá Navigace se nenabízí ve filtrech a konfiguraci. Její body nejsou načítány do plánovacího vstupu a přímý požadavek s navigačním ID je odmítnut. Existující plán obsahující navigační zdroje nelze tímto způsobem schválit nebo přepočítat po vypnutí modulu. Ověřena je také smíšená trasa v organizaci s aktivním modulem.

## 7. Znovupoužité části a rozhraní
Plánování i české vysvětlení jsou deterministické; žádný LLM nemění assignmenty nebo rezervace. Zůstává jeden serverový optimizer, jeden schvalovací tok, canonical WorkAssignment/WorkTask synchronizace, VehicleReservation service, Google Routes/fallback, Photo storage a notification provider. `/work/route` rozlišuje počet zastávek a zakázek. `/my-route` nabízí konkrétní položky a jejich fotografie. `/work/[id]` obsahuje editor přidání, úpravy, zrušení a řešení problémů položek; ID a historie se nepřepisují běžným formulářem zakázky.

## 8. Databáze a konfigurace
WorkOrderItem: updatedAt, nullable executionStatus, startedAt, completedAt, estimatedMinutes, issueType, issueNote a unikátní volitelná vazba crmRealizationId. Photo: volitelná indexovaná vazba workOrderItemId s ochranou referenční historie. Žádný nový FieldJob, Worker, Vehicle ani Photo model.

Migrace `20260915100000_work_item_execution` byla aplikována pouze na izolovanou testovací větev Neonu. Produkční databáze nebyla migrována. Odhad položky má přednost před tenantovým pravidlem `WorkType:CarrierType`, které má přednost před tenantovým WorkType defaultem. Celkové estimatedHours zakázky se nekopírují do každé položky.

## 9. Schválení a přepočet
Generování ukládá DRAFT. Schválení kontroluje aktuální data a odmítne změněné vazby, GPS či konfiguraci. Assignmenty se vytvářejí jednou za pracovníka a rodičovskou zakázku i při mnoha zastávkách a posádkách. Serializable transakce, stabilní klíče a opakování konfliktů chrání souběh. Existující CRM realizátor je tvrdým požadavkem posádky; po schválení se u propojené realizace uloží plánovaný čas a doplní dosud nepřiřazený realizátor. Pozdější změna realizátora blokuje realizaci původní posádkou. Replan vytváří další návrh a vynechává dokončené položky; historie a fotografie zůstávají.

## 10. Tenant, oprávnění a audit
Nové mutation endpointy vyžadují existující module-policy a manažerskou roli. Ověřují organizaci rodiče, položky, nosiče, plochy a CRM vazeb. Worker musí patřit vlastní schválené posádce a mít kanonické pracovní přiřazení. DTO neobsahuje ceny, marže nebo interní CRM poznámky. Stažení položkové fotografie ověřuje vlastní plán a explicitní tenantový kontext. Události používají CrmAuditLog a stávající notifikace se stabilními identifikátory.

## 11. Testy
| Kontrola | PASS | FAIL | SKIP |
|---|---:|---:|---:|
| Hlavní sada (742 testů) | 738 | 0 | 4 |
| Nové jednotkové testy položek (zahrnuté výše) | 13 | 0 | 0 |
| Databázové testy původního planneru | 14 | 0 | 0 |
| Databázové testy Navigation planneru | 10 | 0 | 0 |
| Databázové testy obecných položek | 9 | 0 | 0 |
| Playwright: obyčejné, navigační, billboardové a smíšené trasy | 4 | 0 | 0 |

Čtyři SKIP v hlavní sadě jsou opt-in PostgreSQL testy. Tři Field Planner sady byly provedeny samostatně (celkem 33 PASS); původní samostatný integrační test Navigation conversion zůstává přeskočený stejně jako ve výchozí sadě. Ostatní původní testy nemají regresi.

Ověřeny jsou mimo jiné: 20 položek bez Navigace, rozdělení mezi posádky, stejné GPS s různými identitami, chybějící GPS, odlišné tenantové délky, CRM autorita a přiřazení, změna GPS po DRAFT, souběžné schválení, tenant/RBAC odmítnutí, fotografie přesné položky, jedna dokončená z 20, řešení problému, přepočet na 19 zastávek, editor položek v detailu zakázky a ochrana dokladové fotografie před smazáním.

Finální logy: `output/general-field-tests-final.log`, `output/general-field-items-db-final.log`, `output/general-field-db.log` (původní regresní DB sady) a `output/general-field-browser-final.log`. První průchody odhalily chybějící explicitní tenantový kontext stažení fotografie a timeout při studené kompilaci; finální průchody prošly po opravě kontextu a dokončení kompilace. Souběh databázových sad také ověřil potřebu odstupů při opakování serializačních konfliktů.

## 12. TypeScript a production build

- TypeScript: **0 chyb**, přímý `tsc --noEmit` skončil s exit code 0. Typová kontrola Next buildu také prošla.
- Prisma Client generate: **PASS**.
- Tenant security guard: **PASS**.
- Production build: **PASS**, `npm run build` skončil s exit code 0; vygenerováno 106 statických stránek. Linting je v existujícím build nastavení vypnutý, nejde o tvrzení o samostatně provedeném ESLint běhu.
- `git diff --check`: **PASS**.

Logy: `output/general-field-types-final.log`, `output/general-field-security-final.log`, `output/general-field-build.log`. Vývojový server byl po browser ověření ukončen.

## 13. Omezení a další verze

- Priorita, termín a tvrdá časová omezení jsou zatím zděděné z WorkOrder. Položka má vlastní délku; editor tento rozsah uvádí.
- Existující CRM realizaci vybírá manažer explicitně. Nevznikají automaticky umělé CRM zakázky ani zastávky ze samotného počtu kusů.
- Historické jednoduché WorkOrdery zachovávají původní způsob realizace, dokud nepřejdou na samostatné položky.
- V1 nadále omezuje návrh na 200 zastávek a při přepočtu schváleného plánu zachovává posádky a rezervace; manažer zadává aktuální výchozí GPS.
- Optimalizace je deterministická heuristika. Při nedostupném Google Routes je výsledek označen jako odhad a vyžaduje jeho odsouhlasení.
- E2E ověření používá řízený fallback; úspěch a výpadek Google Routes jsou pokryty kontraktovými testy s mockovaným API, nikoli novým testem ostrého Google účtu.
- Textová položka bez lokalizovaného nosiče nebo plochy zůstává k doplnění; souřadnice se neodhadují.
- Další verze může přidat individuální časová okna položek, hromadný import pracovních míst a individuální pracovní kalendáře. Produkční migrace a nasazení jsou samostatný krok.
