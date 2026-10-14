# Terénní práce – audit a implementační záznam

Základ: aktuální čistá větev `main`, práce ve `feat/field-work`. AGENTS.md nebyl nalezen v repozitáři ani nadřazených adresářích. Produkční databáze nebyla použita.

## A. Ověřené nálezy

| Bod zadání | Zjištění ve výchozím kódu |
|---|---|
| 1 | Potvrzeno: approveAndSaveElectionPlan ukončuje všechny APPROVED/ACTIVE plány kampaně. |
| 2 | Potvrzeno: myRoute deduplikuje podle kampaně, nikoli výjezdu. |
| 3–4 | Potvrzeno: operace je v description; zápis OTHER nemá odpovídající explicitní větev čtení. |
| 5 | Potvrzeno: převoz má jen textový cíl; engine po něm nezvyšuje náklad. |
| 6 | Potvrzeno: kontroluje se pouze součet s předchozím nákladem, nikoli samotný úkol. |
| 7 | Potvrzeno: mezizastávky se ořezávají slice(0, 8). |
| 8 | Potvrzeno: dva rozdílné zapisovače stavů; executeStop neaktualizuje statistiky kampaně. |
| 9 | Potvrzeno: závěrečná vykládka chybí při návratu do depa, jinak se přidává až po kontrole proveditelnosti a ztrácí přestávku. |
| 10 | Potvrzeno: volební adaptér hardcoduje available=true a reserved=false. |
| 11 | Potvrzeno: schválení ukládá klientský input/result bez nové kontroly; přístup do modulu není oprávnění plánovat. |
| 12 | Potvrzeno: executeStop nekontroluje assignedFieldPlanId ani assignedCrewId bodu. |

Další potvrzená chyba: změna posádky upravuje všechny aktivní výjezdy s týmž crewId. Riziko: historické skladové zastávky používají ID nezávislé na plánu. Riziko: přímý upload bodu neověřuje aktuální přiřazení. Existující plannerTransaction již používá SERIALIZABLE a retry P2034/P2002; tuto službu lze využít.

## Využití modelů

FieldPlan a stávající engine zůstávají jediným plánovačem; MyRouteView zůstává společným realizačním klientem také pro WorkOrder/WorkOrderItem a Navigation. WorkOrderItem již má volitelný carrierId, ale jeho realizace předpokládá nosič a má vazby na CRM realizaci. Pro zachování ID, fotografií, kampaní a starých URL rozšiřujeme existující ElectionCampaign/ElectionRemovalPoint jako kompatibilní akci/úkol. Objekt je strukturovaný snapshot úkolu, nevytváří automaticky nosič. Doplňujeme pouze chybějící kroky FieldWorkStep, jejich vlastní množství, přiřazení a fotografie. Nevzniká druhý plánovač, druhá mobilní aplikace ani účetní sklad. Uživatelský název je Terénní práce; technické legacy názvy tabulek a URL zůstávají kompatibilní.

Návrh vylepšení mimo bezpečný automatický převod: sjednocení akcí s obchodními WorkOrder přes explicitní doménovou vazbu. Automatické vytváření CRM realizací či finančních záznamů není součástí převodu.

## Stav ověření

Tento dokument zaznamenává výchozí audit; výsledky implementace, testů a omezení jsou v `field-work-rollout.md`.

## Dodatečné integrační nálezy (13. 10. 2026)

- Potvrzená chyba a oprava: tenant kontext založený pouze uvnitř asynchronního guardu se nepropagoval do volajícího HTTP handleru. Nastavení kontextu je nyní v handleru po ověření identity; prokázáno browserem a doplněno do API regrese.
- Potvrzená starší závada migrační historie: prázdný bootstrap selže na chybějící WorkOrder v migraci 20260703093000. Nová aditivní migrace samostatně prošla proti výchozímu schématu HEAD na izolovaném PostgreSQL. Starší migrace nebyly přepisovány; postup a omezení jsou v rollout dokumentu.

### Dodatečné ověření 14. 10. 2026

Prohlížečový průchod a skutečné databázové transakce odhalily a ověřily opravu dalších dvou problémů: UTC den v mobilním Dnes/Zítra a nestabilní JSON snímek přesunu způsobený celým databázovým krokem uvnitř delivery.location. Přesun nyní prošel reálným schválením, oběma kroky, problémem v cíli i potvrzením držitele materiálu. Podrobnosti a logy jsou v rollout dokumentu.

Finální browserové ověření dále zachytilo P2028 při založení akce. Endpoint používá sdílený plannerTransaction, vynechává prázdný createMany a ukládá audit FIELD_ACTION_CREATED. Následně prošel celý přihlášený průchod i skutečné odmítnutí zápisů pracovníka a do cizí organizace. Finální build, typová kontrola a 132 statických stránek prošly.
