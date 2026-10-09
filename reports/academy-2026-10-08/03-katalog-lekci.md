# Struktura a katalog Akademie

111 navržených lekcí v 18 kategoriích. Jde o úplný výchozí backlog objevených domén, nikoli tvrzení o vyčerpání všech variant formulářů. Před publikací se každý řádek ověří ve své konkrétní roli a modulu. Odhad 3 min je výchozí návrh; u videí cílit 1–3 min a větší činnost rozdělit.

## Navigace modulu

/academy: moje povinné zaškolení, pokračování v lekci, hledání podle úkolu, kategorie. /academy/lessons/[slug]: kroky, médium, časté chyby, ověření, dokončení, nahlášení problému. /academy/paths/[id]: povinné a volitelné lekce. /academy/manage: přiřazení a přehled postupu; /academy/manage/content: redakce a publikace. Všechny tyto adresy jsou **navržené**, v současné aplikaci neexistují.

## Stav a verifikace

PLANNED = téma v backlogu. VERIFIED = obsah ověřen bezpečným browser průchodem a schválen odborným vlastníkem. MEDIA_PENDING = text/scénář připraven, chybí média; samotný tento stav neprokazuje runtime ověření. READY = ověřený obsah, média, přístupnost a odkazy, čeká na publikaci. PUBLISHED = zveřejněná neměnná revize. OUTDATED = změna UI/policy nebo potvrzený problém vyžaduje revizi. Archivace je samostatný archivedAt, nikoli ztráta historie.

Běžná cesta: PLANNED → VERIFIED → MEDIA_PENDING (jsou-li potřeba média) → READY → PUBLISHED → OUTDATED → nová revize. Pilotní koncept může být MEDIA_PENDING již před browser verifikací; READY musí vždy vyžadovat verifiedAt i schválení. Pět pilotů má runtime UNVERIFIED a verifiedAt=null; žádná lekce se nyní nevydává za hotovou.

## Personalizované cesty

- WORKER: START-02/03 → WORK-01/02 → PHOTO-01/02 → WORK-03/04/05. Jen vlastní práce a skutečně dostupné moduly.
- TECHNICIAN: pracovník + NAV-08/12 → SURVEY-02 → STOCK-01/02.
- SALES: START-03 → CRM-01/02 → OFFER-01/03/04/05 → NAV-01/03/04 → OCC-01/03. Interní přijetí nabídky neudělovat.
- MANAGER: obchod + NAV-05 → REAL-01/02/05 → WORK-06 → AI-01/02.
- ACCOUNTANT: START-03 → FIN-01/02/03/04/05 → WORK-06 → REAL-05, pouze povolená data; účetní nemusí mít samostatný přístup do klientského adresáře.
- ADMIN: START-03 → ADMIN-01/02/03/04/05/06, pak role odpovídající pracovní náplni. Platformní ADMIN-09 jen pro SUPER_ADMIN.
- VIEWER: START-02/03/04 → MAP-01/02/03; bez lekcí navádějících k mutacím.

Přiřazená povinná lekce se při odebrání modulu/role označí BLOCKED_BY_ACCESS; nezapočítat ji jako nesplněný osobní výkon. Změna aktivní role může změnit katalog, ale historii dokončení nesmazat. Správce cesty může přidat povinnost pouze k oprávněnému publiku.

## Katalog

Role níže jsou výchozí publikum kategorie, **ne hotová autorizační matice akcí**. Například editaci nosiče nesmí získat VIEWER; schvalování výkazů je užší než vlastní evidence. Před READY je nutné lesson.requiredCapabilities odvodit z konkrétního serverového guardu. Ve strojovém katalogu je pro každou lekci i vstupní route, předpoklady, ověření a prázdná média.

### Začínáme

Priorita P0; výchozí publikum ALL; vstup `/profile`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| START-01 | Aktivovat účet a obnovit heslo | PLANNED |
| START-02 | Přihlásit se a ověřit organizaci | PLANNED |
| START-03 | Přepnout aktivní roli a poznat dostupné moduly | MEDIA_PENDING |
| START-04 | Najít svoji agendu na nástěnce | PLANNED |
| START-05 | Upravit profil | PLANNED |
| START-06 | Přečíst oznámení a otevřít související úkol | PLANNED |

### Mapa a reklamní nosiče

Priorita P0; výchozí publikum ADMIN MANAGER SALES TECHNICIAN VIEWER; vstup `/map`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| MAP-01 | Najít nosič podle mapy a filtrů | PLANNED |
| MAP-02 | Rozlišit nosič a reklamní plochu | PLANNED |
| MAP-03 | Přečíst detail plochy a klienta | PLANNED |
| MAP-04 | Upravit údaje a GPS nosiče | PLANNED |
| MAP-05 | Přidat nosič a ověřit jeho typ | PLANNED |
| MAP-06 | Otevřít galerii a ověřit klientskou viditelnost | PLANNED |

### Focení a fotodokumentace

Priorita P0; výchozí publikum ADMIN MANAGER SALES TECHNICIAN WORKER; vstup `/mobile-photos`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| PHOTO-01 | Vyfotit existující nosič s GPS | MEDIA_PENDING |
| PHOTO-02 | Vybrat správnou stranu a účel fotografie | PLANNED |
| PHOTO-03 | Vyřešit návrh nesprávného přiřazení plochy | PLANNED |
| PHOTO-04 | Nahlásit poškození nosiče fotografií | PLANNED |
| PHOTO-05 | Rozlišit uloženou fotografii a chybu vedlejší akce | PLANNED |
| PHOTO-06 | Postupovat při zamítnuté GPS nebo neúspěšném uploadu | PLANNED |

### Navigační zakázky

Priorita P0; výchozí publikum ADMIN MANAGER SALES TECHNICIAN WORKER; vstup `/navigation`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| NAV-01 | Připravit navigační nabídku pro více provozoven | PLANNED |
| NAV-02 | Doplnit body a terénní fotografie | PLANNED |
| NAV-03 | Nechat klienta vybrat lokality bez objednání realizace | MEDIA_PENDING |
| NAV-04 | Nacenit vybranou navigační trasu | PLANNED |
| NAV-05 | Převést schválenou cenovou nabídku do realizace | MEDIA_PENDING |
| NAV-06 | Připravit smlouvu a grafické podklady | PLANNED |
| NAV-07 | Naplánovat instalaci a přiřadit pracovníky | PLANNED |
| NAV-08 | Dokončit montáž s fotografií a kontrolou kvality | PLANNED |
| NAV-09 | Sestavit a sdílet klientskou fotodokumentaci | PLANNED |
| NAV-10 | Řízeně změnit přijatou navigační zakázku | PLANNED |
| NAV-11 | Připravit fakturační období a fakturu | PLANNED |
| NAV-12 | Provést průzkum lokalit k navigaci | PLANNED |

### Nabídky a obchod

Priorita P0; výchozí publikum ADMIN MANAGER SALES; vstup `/offers`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| OFFER-01 | Vytvořit standardní nabídku klientovi | PLANNED |
| OFFER-02 | Vybrat typ nabídky a šablonu | PLANNED |
| OFFER-03 | Sestavit výběr ploch a termín | PLANNED |
| OFFER-04 | Zkontrolovat cenu a připravenost nabídky | PLANNED |
| OFFER-05 | Odeslat nebo sdílet klientskou nabídku | PLANNED |
| OFFER-06 | Zpracovat dotaz a požadavek na úpravu | PLANNED |
| OFFER-07 | Rozlišit přijetí odmítnutí a expiraci | PLANNED |
| OFFER-08 | Připravit nabídku výstavní sítě | PLANNED |

### Obsazenost a rezervace

Priorita P0; výchozí publikum ADMIN MANAGER SALES; vstup `/occupancy`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| OCC-01 | Ověřit dostupnost plochy v termínu | PLANNED |
| OCC-02 | Založit rezervaci a odlišit ji od jednání | PLANNED |
| OCC-03 | Vyřešit překryv termínů | PLANNED |
| OCC-04 | Změnit nebo ukončit rezervaci | PLANNED |
| OCC-05 | Zkontrolovat obsazenost po přijetí nabídky | PLANNED |

### Klienti a komunikace

Priorita P1; výchozí publikum ADMIN MANAGER SALES; vstup `/clients`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| CRM-01 | Založit a dohledat klienta | PLANNED |
| CRM-02 | Přidat kontakt a pobočku | PLANNED |
| CRM-03 | Najít nabídky a zakázky v kartě klienta | PLANNED |
| CRM-04 | Zapsat komunikaci a navazující CRM úkol | PLANNED |
| CRM-05 | Najít smlouvu a klientský dokument | PLANNED |
| CRM-06 | Zkontrolovat a sloučit duplicitu klienta | PLANNED |

### Realizace zakázek

Priorita P0; výchozí publikum ADMIN MANAGER SALES ACCOUNTANT; vstup `/realization`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| REAL-01 | Zjistit další krok po potvrzení objednávky | PLANNED |
| REAL-02 | Vyřešit chybějící podklady a blokaci | PLANNED |
| REAL-03 | Předat položku do výroby | PLANNED |
| REAL-04 | Zkontrolovat instalaci a fotodokumentaci | PLANNED |
| REAL-05 | Předat hotovou realizaci k fakturaci | PLANNED |
| REAL-06 | Zpracovat změnový požadavek | PLANNED |

### Práce a zaměstnanci

Priorita P1; výchozí publikum ADMIN MANAGER SALES TECHNICIAN WORKER ACCOUNTANT; vstup `/my-tasks`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| WORK-01 | Převzít vlastní úkol | PLANNED |
| WORK-02 | Najít pracovní příkaz a trasu výjezdu | PLANNED |
| WORK-03 | Odevzdat dokončenou práci | PLANNED |
| WORK-04 | Vykázat práci a výdaj | PLANNED |
| WORK-05 | Odevzdat vlastní vyúčtování | PLANNED |
| WORK-06 | Schválit výkaz pracovníka | PLANNED |
| WORK-07 | Požádat o volno a ověřit kolizi | PLANNED |
| WORK-08 | Najít kontakt a použít týmový chat | PLANNED |
| WORK-09 | Přidat pracovníka a nastavit sazby | PLANNED |

### Finance a fakturace

Priorita P1; výchozí publikum ADMIN MANAGER ACCOUNTANT; vstup `/settlements`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| FIN-01 | Rozlišit klientskou fakturu a fakturu pracovníka | PLANNED |
| FIN-02 | Zkontrolovat a schválit vyúčtování | PLANNED |
| FIN-03 | Uzamknout vyúčtování a evidovat platbu | PLANNED |
| FIN-04 | Vytvořit klientskou fakturu v kontextu zakázky | PLANNED |
| FIN-05 | Najít fakturu a její stav v kartě klienta | PLANNED |
| FIN-06 | Zkontrolovat náklady a finanční přehled | PLANNED |

### AI nástroje

Priorita P1; výchozí publikum ADMIN MANAGER SALES; vstup `/commercial`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| AI-01 | Zkontrolovat návrh v AI Inboxu | PLANNED |
| AI-02 | Potvrdit nebo odmítnout navrženou akci | PLANNED |
| AI-03 | Vyhodnotit signál obchodního radaru | PLANNED |
| AI-04 | Použít AI obchodní centrum a dohledat zdroj | PLANNED |
| AI-05 | Vyhodnotit AI upozornění na obsazenost | PLANNED |
| AI-06 | Nadiktovat rychlý interní úkol | PLANNED |
| AI-07 | Ověřit návrh AI rozpoznání fotografie | PLANNED |
| AI-08 | Rozpoznat neověřenou nebo nedostupnou AI odpověď | PLANNED |

### Field Survey

Priorita P1; výchozí publikum ADMIN MANAGER SALES TECHNICIAN WORKER; vstup `/field-survey`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| SURVEY-01 | Založit samostatný terénní průzkum | PLANNED |
| SURVEY-02 | Zaznamenat bod s GPS a fotografií | MEDIA_PENDING |
| SURVEY-03 | Doplnit parcelu vlastníka a kontakt | PLANNED |
| SURVEY-04 | Posoudit AI analýzu místa | PLANNED |
| SURVEY-05 | Exportovat průzkum do KML GeoJSON nebo XLSX | PLANNED |

### Administrace a nastavení

Priorita P2; výchozí publikum ADMIN; vstup `/settings`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| ADMIN-01 | Pozvat uživatele do organizace | PLANNED |
| ADMIN-02 | Nastavit role a ověřit přístup | PLANNED |
| ADMIN-03 | Nastavit firemní profil a fakturační údaje | PLANNED |
| ADMIN-04 | Připojit integraci a ověřit její stav | PLANNED |
| ADMIN-05 | Nastavit firemní odesílání e-mailů | PLANNED |
| ADMIN-06 | Připravit import a zkontrolovat dry-run | PLANNED |
| ADMIN-07 | Spravovat typy nosičů a produkty | PLANNED |
| ADMIN-08 | Dokončit onboarding organizace | PLANNED |
| ADMIN-09 | Spravovat organizace jako platformní administrátor | PLANNED |

### Plánovač a kalendář

Priorita P1; výchozí publikum ADMIN MANAGER SALES TECHNICIAN WORKER ACCOUNTANT; vstup `/planner`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| PLAN-01 | Naplánovat osobní pracovní blok | PLANNED |
| PLAN-02 | Připojit kalendář a zvolit synchronizaci | PLANNED |
| PLAN-03 | Vyřešit souběh práce a absence | PLANNED |
| PLAN-04 | Najít termíny vyžadující pozornost | PLANNED |

### Sklad a nákupy

Priorita P1; výchozí publikum ADMIN MANAGER TECHNICIAN WORKER; vstup `/warehouse`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| STOCK-01 | Najít materiál přes QR | PLANNED |
| STOCK-02 | Zapsat příjem a výdej materiálu | PLANNED |
| STOCK-03 | Zkontrolovat nízkou zásobu | PLANNED |
| STOCK-04 | Připravit nákupní požadavek | PLANNED |
| STOCK-05 | Použít a ověřit AI návrh skladových položek | PLANNED |

### Vozidla a provoz

Priorita P1; výchozí publikum ADMIN MANAGER SALES TECHNICIAN WORKER; vstup `/vehicles`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| CAR-01 | Rezervovat vozidlo | PLANNED |
| CAR-02 | Zapsat tankování a ověřit účtenku | PLANNED |
| CAR-03 | Zaznamenat servis a stav vozidla | PLANNED |

### Výstavní sítě a inventář

Priorita P2; výchozí publikum ADMIN MANAGER SALES; vstup `/projects/city-gallery`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| NET-01 | Založit a sledovat projekt výstavní sítě | PLANNED |
| NET-02 | Dohledat městský inventář | PLANNED |
| NET-03 | Orientovat se v omezeních B2B Network | PLANNED |

### Volební demontáže

Priorita P2; výchozí publikum ADMIN MANAGER TECHNICIAN WORKER; vstup `/election-removal`.

| ID | Konkrétní pracovní úkol | Stav |
|---|---|---|
| ELECT-01 | Importovat kampaň a ověřit body | PLANNED |
| ELECT-02 | Naplánovat trasu demontáží | PLANNED |
| ELECT-03 | Dokončit bod v mobilu | PLANNED |
| ELECT-04 | Předat demontovaný materiál a uzavřít trasu | PLANNED |

