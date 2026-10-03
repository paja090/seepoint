# Kontrola QX promotion – 26. 9. 2026

První průchod produkční aplikací https://seepoint.vercel.app přes prohlížeč dokončen. Kontrola zahrnuje více než 60 různých stránek, navazující záložky, stavové filtry a vybrané formuláře. Jde o kontrolu zobrazení prázdné organizace, ne o dokončený test všech obchodních workflow.
Organizace: QX promotion (`qx-promotion`, `cmui330fi0005l404dx9noytp`).
Účet: existující platformní správce, zároveň aktivní OWNER QX promotion.
Na výslovný pokyn uživatele povoleno a uloženo všech 32 modulů. Tarif nebyl měněn.

## Omezení ověření

- Samostatný účet běžného administrátora zatím není k dispozici. Viditelnost platformní správy a přepínače dalších firem u SUPER_ADMIN není sama o sobě závada.
- Kontrola prázdné organizace ověřuje zobrazené údaje; sama neprokazuje bezpečnost všech API ani opačný směr izolace.

## Nálezy

1. **Onboarding / potvrzovací e-mail:** Formulář slibuje aktivační pozvánku. Existující aktivní účet je rovnou přidán jako aktivní OWNER a e-mail se neposílá. Ověřeno v detailu organizace a lokálním `app/api/admin/organizations/route.ts` (odesílání pouze při `needsActivation`). Chybí jasná informace o tomto scénáři a samostatné potvrzení založení.
2. **Společná hlavička / branding:** Po přepnutí na QX promotion zůstává titulek stránky „SeePOINT Outdoor Reklama“, odkaz „Telefonní seznam týmu SeePOINT“, profilový odkaz „SeePoint – můj profil“ a na dashboardu nadpisový štítek „SeePOINT“. Produktové označení SeePoint OS je nutné odlišit od identity konkrétní firmy.
3. **Dashboard / prázdný stav:** Prázdná firma má „Nejžádanější město Ostrava“ s 0 z 0 ploch. Jde o zavádějící výchozí údaj, nikoli zatím prokázaný únik dat.
4. **Profil po změně organizace:** Jméno Pavel Šubert a avatar se změnily na e-mail a iniciálu S. Ověřit zamýšlené chování identity uživatele napříč členstvími.

## Zkontrolované stránky

- `/dashboard`: QX promotion vybrána; nosiče, nabídky, kampaně, nájemné i inbox nulové. Výše uvedené nedostatky brandingu a prázdného stavu.
- Detail QX promotion v platformní správě: 0 klientů, 0 ploch, 0 nabídek, aktivní OWNER; potvrzeno uložení 32/32 modulů.

## Prioritní nálezy z úplného průchodu

### P1 – B2B adresář zveřejňuje jiné organizace bez partnerství

- Reprodukce: QX promotion → B2B Media Network → Moji B2B partneři (0).
- Viditelné organizace: **Agentura B – izolace** a **SeePoint**, obě s městem Praha a 0 sdílenými plochami.
- To odporuje požadavku uživatele, aby nová firma neviděla názvy ani loga jiných firem.
- Lokální `app/api/network/partners/route.ts` načítá přes `platformPrisma` všechny jiné aktivní organizace. Vrací ID, jméno, město, logo a barvu; podmínka partnerství, zveřejnění či SUPER_ADMIN ve vlastní cestě není. Přístup je omezen obecným `requireApiAccess('offers', 'network')`.
- Výchozí město `org.city || 'Praha'` navíc vytváří nepravdivý údaj.
- Doporučení: adresář prázdný, dokud organizace výslovně nezveřejní partnerský profil nebo nevznikne autorizované partnerství. Platformní přehled ponechat pouze v administraci.
- Potvrzeno živým UI a lokálním kódem; nezávislý test účtem bez SUPER_ADMIN zbývá.

### P1 – Nová navigační nabídka má zapnuté reference a identitu SeePoint

- Stránka `/offers/new/navigation` v QX promotion má předem zaškrtnuté reference KFC/LIDL/Penny, ukázky realizací, garance „400+ ploch, 15+ let zkušeností, Bandimex, 48h servis“ a „O společnosti (Realizátor) – Představení dodavatele SEEPOINT“.
- Lokální `components/offers/NavigationOfferForm.tsx:1195` obsahuje text referencí; `components/offers/NavigationOfferPublicView.tsx:1462` a okolí obsahuje pevné reference, citace a fotografie realizací těchto značek.
- Doporučení: obsah, fotografie, reference a garance patří konkrétní organizaci. Nová firma má mít tyto sekce prázdné/vypnuté. Neodvozovat oprávnění k použití z pouhé aktivace modulu.
- Živě ověřen formulář. Finální klientský odkaz/PDF nebyl generován, protože firma nemá klienta ani nabídku. Tento krok zůstává pro následný funkční test.

### P2 – Firemní branding je na mnoha místech pevný

Vedle společné hlavičky byly nalezeny například:

| Stránka | Nežádoucí obsah |
|---|---|
| `/analytics` | Analytics & Přehled Kapacity SeePOINT |
| `/clients/dashboard` | Chytrý Obchodní Asistent SeePOINT |
| `/chat` | Celý Tým SeePOINT, včetně názvu skupiny a pole zprávy |
| `/shopping` | Firemní nákupní seznam SeePOINT |
| `/work` | Provoz SeePOINT |
| `/work-entries` | Evidence práce zaměstnanců SeePoint |
| `/team` | Tým SeePOINT & Kontakty v terénu |
| `/vacations` | SeePOINT Plánovač Volna & Dovolené |
| `/vehicles` | Kompletní evidence vozového parku SeePOINT; navíc Renault Master, Trafic, H1 při nulové flotile |
| `/profile` | Člen týmu SeePOINT |
| Více stránek | Samostatný štítek SeePOINT a generický hlavní nadpis SeePOINT |
| `/settings/email` | Ukázkové domény a adresy seepoint.cz |
| `/employees` | Placeholder pavel@seepoint.local |

Vizuálně zůstává v levém rohu zelené SP i při aktivní QX promotion. QX zatím nemá logo; fallback by měl používat její iniciály. Produktové označení **SeePoint OS** je třeba vědomě odlišit od identity firmy **SeePoint**. Nestačí plošné nahrazení všech řetězců.

### P2 – Neexistující sklad 24 výstavních nosičů

- `/projects/city-gallery` ukazuje celkový fond 24 a volných 24 kusů (120×180 cm) bez jediného založeného nosiče.
- Stejná hodnota je na záložce Kapacita projektů.
- Ověřená příčina v lokálním `app/projects/city-gallery/page.tsx:25`: `fleetConfig?.totalFrames ?? 24`. Dotazy na projekty a konfiguraci mají filtr organizace.
- Jde o pevný fallback, nikoli důkaz čtení cizích nosičů. Nová firma má začít nulou a výzvou k nastavení fondu.

### P2 – Fiktivní členové týmu v nákupech

- `/shopping` zobrazuje avatary **P, E, T, +3**, přestože organizace má pouze vlastníka a žádné zaměstnance.
- Potvrzené pevné prvky v `components/shopping/ShoppingListModule.tsx` poblíž řádku 570.
- Požadované chování: skuteční členové organizace, případně žádné avatary.

### P2 – Nový vlastník nemá zaměstnanecký profil

- `/my-work-entries` a `/my-settlements` hlásí „Profil nenalezen“.
- `/vacations` má vypnuté tlačítko žádosti, ale text vybízí vložit první žádost tlačítkem nahoře, bez vysvětlení chybějícího profilu.
- `/team` ukazuje 0 aktivních členů týmu, zatímco `/settings/members` správně uvádí 1 aktivního OWNERA. Jde o rozdíl uživatelského členství a zaměstnance, ale rozhraní jej dostatečně nevysvětluje.
- Doporučení: onboarding má nabídnout založení vlastního zaměstnaneckého profilu nebo vysvětlit, které moduly jej vyžadují.

### P3 – Pevné lokality, ceny a technické texty

- Dashboard hlásí nejžádanější město Ostrava při 0 plochách; počasí a depo začínají Ostravou.
- `/work/route` → Nastavení depa nabízí Ostravu (Základna), Prahu a Brno; nevidím pole vlastní adresy.
- `/offers/new/navigation` nabízí pouze Ostravu a Havířov včetně konkrétních rozměrů navigací. Ověřit použitelnost pro agentury v jiných městech.
- `/offers/templates` má orientační sazby 7 900, 2 900, 4 500, 18 000 a 1 200 Kč i při prázdném firemním ceníku. Jsou označené jako orientační; přesto je nutné oddělit obecnou ukázku od vlastních cen firmy.
- `/map` obsahuje technické texty „server-side“, „Výchozí limit mapy není 500“; `/settings` jména proměnných a cest; `/employees` slovo „mock“; `/settings/email` instrukce o redeploy Vercelu. Nejde o odhalené hodnoty tajných klíčů, ale o nevhodný vývojářský obsah pro zákazníka.
- `/occupancy` obsahuje ve stavu řetězec „libre / …“, `/tasks` technické názvy TODO/IN_PROGRESS/LOW apod.

## Pokrytí stránek

Ve všech běžných datových seznamech níže byly při aktivní QX promotion nulové/prázdné hodnoty, kromě výslovně uvedených nálezů. Absence viditelného úniku v seznamu neprokazuje bezpečnost detailových API.

| Oblast | Otevřené stránky | Výsledek |
|---|---|---|
| Přehled | `/dashboard`, `/analytics` | Nulová obchodní data; branding a Ostrava viz nálezy |
| CRM | `/clients`, `/clients/dashboard` | Bez klientů, nabídek a aktivit |
| Nabídky | `/offers`, `/offers/templates`, `/offers/new`, `/offers/new/standard`, `/offers/new/navigation`, `/offers/new/city-gallery` | Seznam prázdný, klientské výběry prázdné; problém navigačních referencí a orientačních sazeb |
| AI | `/ai-inbox`, `/commercial`, `/sales/opportunities`, `/realization`, `/occupancy/ai` | Bez cizích zpráv, příležitostí a nálezů; pravidla radaru otevřena bez uložení |
| Evidence | `/map`, `/carriers`, `/occupancy`, `/projects/city-inventory` | Nula ploch, nosičů, kampaní; mapa se načetla |
| Výstavy | `/projects/city-gallery` | Nula výstav a povolení; všechny čtyři záložky prohlédnuty; chybný fond 24 |
| Navigace | `/navigation`, `/navigation/contracts`, `/navigation/contacts`, `/navigation/documentation`, `/navigation/installations`, `/navigation/installations/planning` | Nula zakázek, smluv, kontaktů, reportů a montážních bodů; vytvoření smlouvy/kontaktu správně vyžaduje klienta |
| Terén | `/mobile-surveys`, `/mobile-photos`, `/my-route` | Prázdné projekty a trasy; test nezískával GPS a nepořizoval fotografie |
| Osobní agenda | `/my-tasks`, `/planner`, `/my-work-entries`, `/my-settlements`, `/vacations`, `/profile` | Bez cizích úkolů a událostí; chybějící zaměstnanecký profil |
| Provoz | `/work`, `/work/route`, `/tasks`, `/production`, `/work-entries`, `/settlements` | Nulová data; otevřeny formuláře úkolu a tiskové zakázky, bez cizích klientů/pracovníků |
| Majetek | `/vehicles`, `/vehicle-reservations`, `/warehouse`, `/warehouse/print-qr`, `/shopping` | Prázdná flotila, rezervace, sklad, QR arch a nákupy; fiktivní avatary v nákupech |
| Tým | `/employees`, `/team`, `/chat`, `/settings/members` | Žádní cizí zaměstnanci nebo zprávy, pouze vlastní OWNER v členství; nesprávný branding |
| Nastavení | `/settings`, `/settings/company`, `/settings/email`, `/settings/integrations`, `/settings/planner`, `/settings/carrier-types`, `/settings/products`, `/settings/work` | QX promotion, prázdné firemní údaje a ceníky, nepřipojený Gmail/Drive/Calendar; 7 základních typů nosičů, 9 obecných činností, žádné produkty |
| Import | `/import` | Bez historie importů; kontrolován vstupní krok, bez nahrávání souborů |
| B2B | `/network` | Všech 7 záložek; katalog prázdný, adresář zobrazuje jiné firmy; transakční moduly zatím neaktivní |
| Platforma | `/admin/organizations`, detail QX promotion, `/onboarding` | Přístup očekávaný u SUPER_ADMIN, členství OWNER aktivní, onboarding 2/5, 32/32 modulů uloženo |

Navíc ověřeny: tři filtry průzkumů, tabulka/karty/kanban navigace, všech 11 zobrazených stavových a rychlých filtrů navigace, filtr nízkého skladu, notifikační panel (0), globální hledání „STAN“ (žádný výsledek), AI úkolníček (bez cizích pracovníků). Formuláře nebyly odeslány.

## Co zbývá pro úplný funkční a bezpečnostní test

1. Samostatný účet ADMIN pouze pro QX promotion: menu, přepínač firem, přímé adresy platformní správy a serverové odmítnutí nepovolených operací.
2. Vlastní testovací klient, nosič, nabídka, zakázka a zaměstnanec: tvorba, úpravy, ukládání a vazby v rámci QX promotion.
3. Ověření klientského portálu, PDF, faktury a e-mailů s vlastním brandingem na konkrétní nabídce. Doposud ověřen vstupní formulář a vybrané části lokálního kódu.
4. Obousměrné oddělení konkrétních záznamů mezi dvěma organizacemi a oprávnění jednotlivých rolí.
5. Ověření importu, uploadu fotografií a připojených služeb na vlastních testovacích datech.

V průchodu 26. 9. byly změněny pouze moduly QX promotion (32/32) a aktivní organizace. Kód aplikace nebyl opravován ani nasazován; uložen je tento audit.

## Pokračování 29. 9. 2026 – uložení klienta, nabídky a ověření izolace

- Úspěšně založen syntetický klient `TEST QX – kontrola izolace`, ID `cmumpfujo0001l804ky2to19h`. Bez e-mailu, telefonu či skutečných firemních údajů.
- Úspěšně uložena nabídka `TEST QX – audit navigace – NEODESÍLAT`, ID `cmumphtcs0001ld04qihb01n9`, stav Draft, fáze 1 bez cenových závazků. Obsahuje jednu fiktivní provozovnu a dva označené testovací navigační body. Výchozí poloha z formuláře u Golčova Jeníkova není skutečná provozovna QX. Nebyla odeslána ani schválena, nevznikla objednávka.
- Ověřen detail nabídky, interní klientský náhled i skutečný tokenový klientský odkaz. Veřejný odkaz aplikace vytvořila automaticky při uložení Draftu. Otevření odkazu může zaznamenat zobrazení; e-mail ani zpráva nebyly odeslány.
- **P1 potvrzen v klientském výstupu:** QX nabídka obsahuje logo SeePoint, reference KFC/LIDL/Penny, fotografie Penny/McDonald's/LIDL a další společné snímky, metriky 400+ ploch, 150+ tras, 15+ let zkušeností a garanci 48 hodin. Nadpis dodavatele je správně `O společnosti QX promotion`, ale popis automaticky tvrdí specializaci na Ostravu a okolí. Závěrečné výzvy nadále jmenují SeePOINT a jeho obchodníka. Nejde jen o chybný popisek ve formuláři.
- Obrazový důkaz: [Veřejný náhled nabídky](qx-promotion-offer-2026-09-29.png).
- **P2 výchozí ceny:** vložení navigačního bodu předvyplnilo roční nájem 12 000 Kč, rám 1 960 Kč, tisk 600 Kč, montáž 800 Kč, demontáž 600 Kč. QX měla při prvním průchodu prázdný vlastní ceník. Fáze 1 ceny ve veřejném zobrazení skrývá.
- **P2 zavádějící CRM detail:** nově vytvořený klient bez historie má hodnocení `Zdravý vztah (85 b.)`, poslední kontakt `0 dní` zároveň s `Bez záznamu`; pobočky jsou natvrdo pojmenované `MS Kraj`.
- Ověřena validace nabídky: bez provozovny nelze uložit, bez navigačního bodu server vrátí chybu. Formulář umožnil uložit návrh bez fotografií bodů, ve fázi 1 o tom informuje.
- **Izolace konkrétních záznamů prošla v tomto rozsahu:** QX seznam vyhledá testovacího klienta (1 výsledek). Po přepnutí aktivní organizace na Agenturu B – izolace hledání stejného klienta vrátí 0 výsledků. Přímá adresa QX klienta i interní nabídky vrací v kontextu Agentury B stránku 404. Test proběhl na účtu SUPER_ADMIN s přepínáním aktivní organizace; nenahrazuje test samostatného účtu ADMIN.
- Chybová stránka 404 sama obsahuje logo SeePOINT a kontakt `info@seepoint.cz`.
- Testovací klient a nabídka zůstávají uložené pro další kontrolu. Kód ani nasazení nebyly měněny. Stále zbývají testy běžného ADMIN, PDF, e-mailů, dalších zápisových workflow a opačného směru izolace.

## Lokální opravy 29. 9. 2026 (dosud nenasazeno)

- Veřejné nabídky, koncepty kampaní, klientský portál a e-mail nabídek používají vlastní logo organizace, případně její název. Chybějící kontakty se nedoplňují kontakty SeePointu. Chybové stránky jsou neutrální.
- Reference, fotografie realizací a metriky původního portfolia jsou omezené na kanonické ID původní organizace. Název obsahující SeePoint ani dříve uložené zapnuté přepínače k tomuto portfoliu neopravňují. QX nemá automaticky připsané vlastní výrobní kapacity, servisní garance nebo cizí klientské reference. Standardní prezentace a data předaná PDF dostávají prázdné reference a neutrální náhradu chybějících fotografií.
- B2B adresář již nevyjmenovává ostatní aktivní organizace. Do implementace oboustranně potvrzených partnerství vrací prázdný seznam. Výjimka tohoto endpointu z tenantové kontroly byla odstraněna. Samostatný inventář nadále vyžaduje explicitní sdílení MARKETPLACE.
- Nové navigační body čerpají ceny pouze z vlastního ceníku, jinak mají prázdné sazby. Cenovou nabídku nelze ve formuláři uložit s nedoplněnými sazbami; neúčtovaná položka vyžaduje výslovnou nulu. Již uložené částky nejsou hromadně přepisovány.
- Prázdný vozový park Galerie venku nezobrazuje fiktivních 24 rámů. Odstraněny fiktivní avatary týmu v nákupním seznamu. Nový klient bez historie nemá skóre 85 ani kontakt odvozený z pouhého vytvoření/úpravy záznamu. Obecná záložka poboček již netvrdí MS kraj.
- Založení organizace s existujícím aktivním vlastníkem výslovně informuje, že se aktivační e-mail neposílá. Nový/neaktivní účet nadále používá pozvánku a hlášení chyby odeslání.
- **Další P1 z kódu:** e-maily nabídek automaticky přidávaly globální BCC; oznámení reakce klienta mohla použít globální kontakt nebo kontakt klienta. Tenantové e-maily již globální BCC nedědí, oznámení míří na autora nabídky či kontakt její organizace. Nové organizace musí mít ověřeného firemního odesílatele a dostupný Resend; odpovědi používají firemní reply-to nebo firemního odesílatele. Bez konfigurace se produkční odeslání zastaví s chybou.
- **Další P1 z kódu a testů:** veřejný portál přijímal interní ID nabídky a uměl automaticky obnovit/publikovat token. Nyní vyžaduje hash uloženého tokenu, publikovaný a neodvolaný odkaz. Veřejné načtení nezapisuje a nehledá kandidáty v ostatních organizacích. Interní načtení detailu nepřepisuje odkaz. Nové tokeny jsou náhodné; existující uložené platné tokeny zůstávají použitelné, neobnovitelný token se tiše nenahrazuje jiným.

### Ověření a zbývající rozsah

- Celá sada: 835 testů, 831 úspěšných, 4 přeskočené, 0 selhání. Opravena konfigurace Node test runneru pro serverový marker `server-only` (produkční Next.js marker zůstává beze změny).
- Navíc samostatný nový runtime test veřejného načtení: interní ID, neznámý token, odvolaný a nepublikovaný odkaz jsou odmítnuty; žádné publikování ani prohledávání organizací. Test úspěšný.
- Regresní test skutečně vykreslené navigační nabídky QX se starými zapnutými přepínači potvrzuje absenci loga, kontaktů a referencí SeePointu. Testy také ověřují prázdný B2B adresář, vlastní branding a BCC.
- `typecheck`, `security:tenant` a kontrola whitespace diffu prošly. Výsledky jsou lokální; nebylo provedeno nasazení, odeslání e-mailu ani změna produkčních dat.
- Stále zbývá ověřit nasazenou verzi v prohlížeči, exportované PDF a skutečné doručení přes vlastní firemní doménu; otestovat běžný účet ADMIN a další zápisová workflow. Specializované AI dohledávání poboček má stále regionální zaměření a vyžaduje samostatné posouzení. Tento zápis není potvrzením kompletní izolace všech funkcí aplikace.

## Testovací nasazení a pokračování 30. 9. 2026

- Finální Preview: https://seepoint-6no5lviet-pavels-projects-073588fb.vercel.app
- Deployment ID: dpl_CyBSDsxCJzL62A9n8cCGrn12rLb3. Vercel CLI potvrdilo READY, úspěšnou kompilaci, kontrolu typů a generování stránek. Produkční doména nebyla přesměrována ani aktualizována.
- V .vercelignore doplněno vyloučení .env*, lokálního service-account JSON a testovacích výstupů. Finální build nepřebírá lokální .env.production.
- Na prvním Preview stejného aplikačního kódu (dpl_CCnfg1XYDuQEME6tRj41JVd4Qfpa) byla v prohlížeči načtena testovací nabídka QX: vlastní název QX promotion, žádné původní reference SeePointu, žádné náhradní logo nebo kontakty jiné firmy.
- Nové zbývající závady: testovací nabídka u Golčova Jeníkova stále uvádí technické parametry Ostravy (město bylo předvyplněno ve formuláři). Klientská mapa ukazuje pokyny k přidávání/přesouvání bodů a technické popisky Google API. Tyto nálezy zatím nejsou opraveny.
- Lokální Next build prošel kompilací; byl ukončen během další kontroly typů, protože kompletní vzdálený build již úspěšně proběhl.
- Otevření finálního Preview a živý test zamítnutí interního ID nejsou dokončeny: automatická kontrola prohlížeče nejprve selhala kvůli limitu. Dne 30. 9. read-only kontrola účtu hlásila ordinaryUsageAllowed=true, ale browser review nadále odmítlo opakování a vyžádalo výslovný souhlas uživatele s opětovným otevřením konkrétního odkazu. Blokace nebyla obcházena alternativním prohlížečem ani HTTP požadavkem.
- Dosavadní lokální regresní testy odmítnutí ID/tokenů zůstávají platné; toto nenahrazuje kontrolu finálního Preview, běžného ADMIN účtu, PDF a doručování e-mailů.

### Dokončení povolené kontroly finálního Preview – 30. 9. 2026

Po výslovném souhlasu uživatele bylo finální Preview úspěšně otevřeno v prohlížeči. U testovací nabídky QX ověřen vlastní název v hlavičce a sekci realizátora, absence loga SeePointu, jeho referencí a náhradních kontaktů. Provedena i vizuální kontrola hlavičky.

Přímé otevření veřejné cesty /offer/ s interním ID testovací nabídky zobrazilo „Nabídka nebyla nalezena“. Žádný obsah nabídky ani cizí branding se nezobrazil. Následně znovu otevřen platný tokenový odkaz, který nadále funguje. Předchozí blokace kontroly těchto dvou stránek je tím vyřešena. Nebyla odeslána reakce, schválení, zpráva ani e-mail. Produkční doména stále nebyla aktualizována. Zbývající technické popisky mapy, regionální výchozí hodnoty a test samostatného ADMIN účtu zůstávají otevřené.

## Oprava města a klientské mapy – 30. 9. 2026

- Formulář i server přestaly automaticky dosazovat Ostravu. Pole města přijímá skutečnou lokalitu i prázdnou hodnotu. Místní technické specifikace se zobrazují pouze po výslovném zadání města v aktualizovaném formuláři; staré automatické hodnoty nejsou považovány za potvrzení.
- Klientský pohled předává mapě readOnly. Google mapa skrývá vyhledávání provozovny a pokyny pro editaci. Náhradní Leaflet mapa také blokuje přidávání a přesouvání bodů, ale zachovává výběr bodu pro prohlížení.
- Odstraněn popisek Google Maps Routes API z klientského souhrnu. Obecný popis lokality již netvrdí, že formát byl schválen.
- Lokálně prošel typecheck, security:tenant a 7 cílených regresních testů (města, staré hodnoty, branding a obě varianty mapy). Whitespace diff bez chyb.
- Uživatel potvrdil, že samostatný ADMIN účet zatím nemá. Čeká se na nový e-mail; účet nebyl vytvořen ani pozván.

### Ověření aktualizovaného náhledu

Preview https://seepoint-o96syn8tc-pavels-projects-073588fb.vercel.app (dpl_J69aQjbV9s1VU6qak6mGg7zFnAxa) úspěšně sestaveno a otevřeno v prohlížeči na existující nabídce QX. Klientský pohled již neobsahuje vyhledávání provozovny, pokyny k přidávání/přesouvání bodů, popisky Google Routes API ani tvrzení o Ostravě. Místo toho ukazuje lokální značení a nutnost ověření konkrétní lokality. Vlastní branding QX zůstal zachován. Uložené testovací body a rozměry nebyly přepisovány a nic nebylo odesláno ani schváleno. Produkce stále beze změny. Praktický test ADMIN čeká na nový e-mail od uživatele.


## 2026-09-30 – Samostatný syntetický ADMIN

Na výslovné přání uživatele založen účet `qx.audit.admin.12861c1407@example.invalid` (TEST QX – audit ADMIN). Aktivní členství pouze QX promotion, role ADMIN; platformRole=null. Původní owner účet nezměněn. Přihlašovací údaje v `.env.qx-admin-audit.local`, vyloučeno z Gitu a Vercel uploadu. Založeno přes databázové připojení Preview; nejde o test doručení e-mailu.

Na aktuálním Preview ověřeno přes skutečné přihlášení a API: login 200, vlastní testovací klient 200, vlastní testovací nabídka 200, seznam platformních organizací 404, přepnutí do org_seepoint_default 404. GET detailu platformní organizace vrátil 405, protože metoda není implementována; tento výsledek se nepočítá jako test oprávnění. Výsledky bez tajných údajů v `scratch/qx-admin-api-results.json`. Kontrola všech obrazovek pod tímto ADMIN účtem dosud nedokončena.


## 2026-09-30 – Kontrola aplikace pod samostatným ADMIN účtem

Prohlížeč přihlášen účtem TEST QX – audit ADMIN. Prošlé hlavní moduly: dashboard, nastavení firmy, členové, e-mail, integrace, systémové nastavení, kalendář a jeho nastavení, onboarding, analytika, nabídky a všechny tři formuláře nové nabídky, katalog šablon, partnerská síť, CRM, AI obchodní centrum, AI Inbox, radar, realizace, mapa, nosiče, průzkum lokalit, obsazenost, navigace, výstavní sítě, městský inventář, osobní úkoly, osobní výkazy a vyúčtování, dovolené, plán práce a výjezdů, úkoly, výroba, nákupy, firemní výkazy a vyúčtování, vozidla, sklad, zaměstnanci, import, tým, chat, profil, mobilní fotografie, navigační smlouvy, kontakty, dokumentace, plánování montáží, mobilní montáže a katalogy typů nosičů, produktů a činností.

V zobrazených přehledech nebyly zjištěny soukromé záznamy jiné firmy. QX má jednoho testovacího klienta a nabídku, dvě vlastní členství a jinak prázdné provozní evidence. Osobní výkazy a vyúčtování správně hlásí chybějící zaměstnanecký profil. Integrace a kalendář nejsou připojené. B2B katalog uvádí svůj pilotní režim; žádné cizí nabídky ploch se nezobrazily. Kalendáře, nákupy, historie importů a katalogy byly dodatečně zkontrolovány po dokončení načítání.

Přímé otevření /admin/organizations pod ADMIN skončilo 404. API test přihlášení: 200; vlastní QX klient a nabídka: 200; seznam organizací: 404; přepnutí na org_seepoint_default: 404; existující klient a existující nabídka jiné organizace: oba 404. Pro negativní test se z databáze přečetla pouze ID jednoho cizího klienta a nabídky; jejich obsah se nevypisoval.

### Nalezené a opravené zbytky původní firmy

- Hlavička a mobilní menu nově používají název/logotyp aktuální organizace; logo původního SeePOINT se jako fallback používá pouze u canonical org_seepoint_default. QX bez loga používá vlastní název.
- Odstraněn pevný SeePOINT nadpis společného PageHeader a cizí pojmenování týmu, chatu, profilu, provozu, dovolených, analytiky, CRM a vozového parku. Titulek aplikace je produktové SeePoint OS.
- Prázdný manažerský dashboard již nevydává Ostravu za nejžádanější město. Počasí se načítá až po volbě města a nepředstírá teplotu 21/20 stupňů ani datum 1.1.
- Výstavní modul a nabídky používají obecné názvy místo Galerie VENKU; odstraněný pevný rozměr fondu nosičů a modely vozidel bez opory ve firemních datech.
- Katalog šablon již neobsahuje hardcoded orientační ceny 7900/2900/4500/18000/1200 Kč ani slib městských povolení v ceně. Nabídky odkazují na vlastní ceník organizace. Odstraněn nepodložený slib AI návrhu do 3 vteřin.
- Nastavení neukazuje vývojářské instrukce o databázové proměnné či ukládání fotografií a texty e-mailového nastavení neodkazují na redeploy platformy.

Omezení: jde o kontrolu zobrazení a vybraných oprávnění, nikoli dokončení všech operací. Nebyla odeslána nabídka, pozvánka ani chatová zpráva, nebyly připojeny externí účty a nebyla potvrzena fakturace nebo montáž. Finální doručení e-mailů stále vyžaduje skutečnou schránku/doménu. Vzorové geografické vrstvy mapy (Ostrava) nejsou soukromá tenantová data; jejich právní aktuálnost nebyla tímto auditem ověřována.

Validace: 12 testů navigace, role clarity a finanční analytiky; 27 testů nabídkového brandingu, výstavního modulu, AI nabídek a nových regresí workspace – všechny prošly. Typecheck a tenant security guard prošly. Podrobný průběžný UI výpis je lokálně v scratch/qx-admin-ui-audit-2026-09-30.json. Kód není nasazen do produkce.


### Finální Preview a ověření oprav

Preview: https://seepoint-hna3fr73e-pavels-projects-073588fb.vercel.app (dpl_GSxqeiY9XuXbYEfBi4Lr8k6gLfgr), vzdálený Next build dokončen úspěšně. Přihlášení QX ADMIN přes UI funguje. Dashboard zobrazuje QX promotion, žádnou smyšlenou lokalitu ani teplotu. Čtrnáct dotčených stránek znovu prohlédnuto bez původních názvů a pevných cen; log v scratch/qx-admin-final-ui-checks.json. Mobilní viewport 390×844 ověřen: hlavička a menu QX promotion, role Administrátor. Viewport vrácen na výchozí. Screenshoty reports/qx-admin-dashboard-2026-09-30.png a reports/qx-admin-mobile-2026-09-30.png. Lokální soubor přihlašovacích údajů nyní obsahuje URL finálního Preview. Průběžný UI protokol zahrnuje 53 různých cest plus dashboard, členové, nastavení firmy, samostatné mobilní montáže a odmítnutou platformní administraci ověřené samostatnými snímky.

## 2026-10-01 – Výstavní nabídka a export PDF

Pod účtem QX ADMIN byl uložen testovací koncept `cmunyrood0006jm04zjhep718` (TEST QX – výstavní koncept ADMIN – NEODESÍLAT), stav DRAFT, bez odeslání klientovi, objednávky nebo rezervace. Interní i veřejné API vrací 200 a identitu QX promotion; veřejná odpověď neobsahuje interní poznámku. Export PDF vrací 200.

V exportu byla nalezena obsahová chyba: šablona výstavního projektu zobrazovala prázdnou tabulku reklamních ploch a vynechávala koncept, lokalitu a realizaci. Opraveno rozlišení CITY_GALLERY, nadpis dokumentu, úvod, popis ceny a tvrzení o automatické rezervaci. Interní náhled nabídky nyní dostává branding organizace a nepoužívá pevný SeePOINT nadpis.

Lokální ověření: 8 cílených testů brandingu a workspace, typecheck a tenant security guard prošly. Vygenerován a vizuálně zkontrolován dvoustránkový syntetický PDF s nenulovou cenou: koncept, lokalita, realizace, QX identita a součet 12 100 Kč přítomny; interní poznámka a původní texty rezervace/katalogu nepřítomny. Kontrola textu používá normalizaci mezer kvůli PDF oddělovačům tisíců.

Prohlížeč byl přechodně nedostupný; později spojení obnoveno. Při převzetí existujícího tabu se jeho stránka změnila mimo tento audit, proto následnou kontrolu odděluji do vlastní záložky. AI radar nyní obsahuje veřejné obchodní signály; jejich faktická aktuálnost není výsledkem této kontroly.

Doplnění UI: interní náhled na Preview 4g9mqgof4 zobrazuje QX promotion a správný koncept. Veřejná stránka obsahovala mylný nadpis „navigační nabídka“; upraven na obecné „nabídka“. Stránka schválení správně deaktivuje odeslání testovací nabídky (chybí kontakt, platnost, kladná cena). Zbývá opravit nepřesnou hlášku kontroly klienta: při vybraném klientovi bez kontaktu uvádí „Doplňte název klienta.“ Žádné odeslání ani schválení nebylo provedeno.

PDF z nasazeného Preview 4g9mqgof4 skutečně stažen přes veřejné API a obě stránky vizuálně zkontrolovány; obsahuje uložený koncept, QX identitu, žádnou interní poznámku. Nabídka nadále DRAFT. Deploy dpl_59pFGQuWVWxbhFHaMA5PZFUeyjiK READY.

Finální Preview: https://seepoint-ex5x557xa-pavels-projects-073588fb.vercel.app, deployment dpl_BfEhVKsB6QC9cnu3CXhvSnfKB4nv READY. Veřejný náhled ověřen v prohlížeči: QX promotion, koncept a lokalita, obecný nadpis „Vyhovuje vám tato nabídka?“, bez interní poznámky. Screenshot reports/qx-exhibition-preview-2026-10-01.png. Přístupové údaje lokálně aktualizovány na nové Preview; produkční nasazení nebylo provedeno.

## 2026-10-01 – Povolený e-mailový test na vlastní adresu

Uživatel výslovně povolil testovací zprávy na subert.pvel@gmail.com. Pod QX ADMIN provedeno GET /api/settings/email: 200, settings=null. POST /api/settings/email/test s tímto příjemcem skončil HTTP 400 „Nejprve připojte firemní doménu.“ Žádná zpráva tedy neodešla, poskytovatel nebyl osloven. Nenastavován náhradní odesílatel jiné firmy. Je potřeba určit vlastní doménu/adresu QX a ověřit její DNS. Dotaz na tyto údaje předán uživateli; následně bude nutné pro omezený test povolit odeslání v Preview a zkontrolovat doručení.

Opravena hláška klienta v offerReadinessChecks: rozlišuje chybějící název klienta, chybějící e-mail a neplatný e-mail. Validační pravidla se nezměnila. Patnáct existujících testů readiness, e-mailové politiky, domén a tenantových příjemců prošlo; typecheck a diff check také.

### Náhled e-mailu – další nález identity původní firmy

Po povolení testovacích e-mailů otevřen dialog „Náhled a úprava e-mailu“. Nalezen pevný předmět Nabídka SeePOINT, obrázek /seepoint-logo.svg a podpis Obchodní kontakt SeePOINT. To nebylo opravou samotné serverové e-mailové šablony pokryto: vlastní předmět z UI by se předal odesílacímu API.

Opraveno v OfferApproval → OfferSendControl → OfferEmailPreviewDialog: branding nabídky předán do dialogu, výchozí předmět sestaven z názvu organizace, zobrazení loga přes společný OfferBrandMark, podpis bez pevné firmy. Při chybějící identitě neutrální fallback. Přidána renderovací regrese pro QX bez loga a pro chybějící branding; osm testů brandingu/příjemců prošlo. Typecheck a diff check prošly. React kontrola: beze změny síťových požadavků, hooků či oprávnění; předávají se pouze již dostupné údaje nabídky.

Preview opravy kontaktní hlášky 8kysufqvr: dpl_3GnoJ4SZgfpFDVQaqom9wDx8HVA1 READY. Hláška potvrzena v prohlížeči, doklad reports/qx-email-readiness-2026-10-01.png.

Finální Preview e-mailového náhledu: https://seepoint-a31nl6sg9-pavels-projects-073588fb.vercel.app, dpl_BEkGdyLEsNwSHnf2wAZLbAemJ3aw READY. Po přihlášení QX ADMIN ověřen dialog v prohlížeči: předmět „Nabídka QX promotion – TEST QX – ověření formuláře“, vlastní název místo cizího loga a podpis „Obchodní kontakt“. Screenshot reports/qx-email-preview-2026-10-01.png. Produkce není aktualizována. E-mail nebyl odeslán: čeká se na doménu odesílatele QX; povolený příjemce zůstává subert.pvel@gmail.com.

## 2026-10-01 – Nový Google účet a integrace

Uživatel povolil založení samostatného Google účtu, jeho připojení k QX (úložiště, kalendář, pošta) a testovací zprávu na svůj Gmail. Registrace zahájena v samostatné záložce accounts.google.com, název QX promotion. Google vyžaduje datum narození správce; dotaz položen uživateli. Datum nevymyšleno, účet zatím NEVYTVOŘEN, žádné nové heslo ani přihlašovací údaje zatím nejsou.

UI nastavení QX potvrzuje Gmail i Google Drive Nepřipojeno a Calendar žádný připojený účet. OAuth Drive úspěšně otevře výběr účtu, ale jeho redirect_uri z Preview míří na https://seepoint.vercel.app/api/integrations/google/callback. To je riziko neplatné host-only OAuth cookie mezi Preview a produkcí; skutečný callback zatím neproběhl. Osobní účet uživatele nebyl pro QX vybrán ani připojen.

Zjištěný rozsah: Gmail integrace požaduje jen gmail.readonly, nikoli gmail.send; nové Gmail připojení samo neumožní odesílání nabídek. Kalendář požaduje calendarlist.readonly a events.readonly. Google Drive používá drive.file. End-to-end upload/download, sync kalendáře, čtení schránky a odesílání zatím nelze označit za ověřené.

57 cílených testů Google Drive, OAuth, tenant storage, photo storage readiness, planner security/scheduling a AI mailbox prošlo. Jde o automatické testy, nikoli o důkaz živého připojení nového Google účtu.

### Registrace Google – čeká na ověření telefonem

Po dodání data narození uživatelem pokračovala registrace. Z dostupných adres vybrána qxpromotion101@gmail.com, nastaveno náhodné heslo a uloženo do gitignored .env.qx-google-test.local se stavem PENDING_REGISTRATION. Účet není potvrzený ani připojený. Google vyžádal ověření zařízení/telefonu QR kódem; krok předán uživateli, bez obcházení. Registrace ponechána otevřená. Screenshot pro předání: reports/qx-google-verification-2026-10-01.png. Žádná testovací zpráva neodeslána.

### Dokončení účtu a živé ověření integrací (1. 10. večer)

Uživatel dokončil vytvoření qxpromotion101@gmail.com a sám nastavil platné heslo. Původní neplatné heslo odstraněno z lokálního souboru; současné heslo agent nezná. Uživatel sám prošel upozorněními Google na neověřenou aplikaci.

Google Drive připojen v produkci k QX. Pod testovacím QX ADMIN na Preview ověřeno nahrání testovacího PNG (201, GOOGLE_DRIVE), autorizované stažení (200, shodný SHA256), odmítnutí anonymního čtení (401) a odstranění testovacího souboru (200). Výsledky scratch/qx-storage-results.json. Gmail připojen pro čtení; AI Inbox po synchronizaci hlásí úspěch a jednu načtenou zprávu. Screenshot reports/qx-google-connected-2026-10-01.png.

Z nové schránky přes Gmail UI odeslána jediná povolená testovací zpráva na subert.pvel@gmail.com, předmět „TEST QX – ověření nové schránky – 1. 10. 2026“. Gmail potvrdil odeslání. Nezávislé vyhledání v cílové osobní schránce potvrdilo přijetí v INBOX, čas 2026-10-01T20:39:43+02:00, message id 1a0f8c41a8c2c440. Doklad reports/qx-test-email-sent-2026-10-01.png. Toto ověřuje Gmail, nikoli odesílání nabídek ze SeePointu: připojení aplikace má pouze gmail.readonly a QX nemá ověřenou odesílací doménu.

Po výslovném schválení uživatelem přidána OAuth návratová adresa https://seepoint.vercel.app/api/planner/calendar/callback do klienta SeePoint SaaS Preview v projektu SeePoint Drive Integration. Stávající adresy zachovány. Následné připojení kalendáře proběhlo bez redirect_uri_mismatch. Připojení patří přihlášenému owner uživateli v QX; nejedná se o test samostatného ADMIN kalendáře.

Synchronizace kalendáře zatím nefunguje: CONNECTED, syncStatus ERROR, errorCode RATE_LIMITED, lastSyncAt null. Kód providers/google.ts chybně označuje každou HTTP 403 jako RATE_LIMITED. Google Cloud detail potvrdil nezapnuté Google Calendar API (tlačítko Enable). Aktivace zároveň přijímá podmínky Google APIs a Google Calendar API, proto vyžádán konkrétní souhlas uživatele; zatím neaktivováno. Doklad reports/qx-calendar-api-enable-2026-10-01.png. Backoff ani oprávnění nebyly obcházeny. Produkční kód nebyl nasazen.

### Calendar API aktivováno uživatelem
Po zprávě hotovo ověřeno v Google Cloud: Calendar API Enabled. V produkčním SeePointu synchronizace v 20:49:50 načetla kalendář qxpromotion101@gmail.com. Kalendář vybrán k importu, ponechána viditelnost Pouze volno / obsazeno a typ Osobní. Následná synchronizace 20:50:21 úspěšná, UI Kalendáře aktualizovány. Screenshot reports/qx-calendar-sync-success-2026-10-01.png. Přenos konkrétní testovací události ještě není ověřen; odesílání nabídek z aplikace stále čeká na vlastní odesílací doménu.

## 2026-10-02 – Přenos události a odesílání přes Gmail

Živý test 1. 10. večer: v testovací Google schránce vytvořena událost TEST QX – synchronizace SeePoint – 2026-10-01 bez hostů, 21:00–22:00 Europe/Prague. Po počáteční chybě inicializace předvoleb Google, obnovení stránky a opakování Google potvrdil uložení. Synchronizace SeePointu v 20:55:45 přenesla název i čas, ověřeno v Planneru QX. Screenshot qx-calendar-event-import-2026-10-01.png. Poté testovací událost smazána v Google; další synchronizace v 20:57:40 ji odstranila z Planneru. Screenshot qx-calendar-event-cleanup-2026-10-01.png. Testovací událost nezůstala v aktivním kalendáři.

Uživatel výslovně zvolil doplnění odesílání přes připojený Gmail. Implementováno volitelné rozšíření OAuth o gmail.send, vázané do podepsaného state. Standardní připojení AI Inboxu nadále požaduje pouze čtení. Callback odmítá chybějící i širší než vyžádané granty. Tenantový transport vybírá pouze vlastní jedinou připojenou schránku s gmail.send; více odesílatelů nebo chybný token znamenají chybu, nikoli použití platformního odesílatele. From/Reply-To odpovídají ověřené Google adrese. HTML/přílohy v MIME, bez platformní BCC; potvrzení pouze po vrácení Gmail message ID. Při chybě se automaticky neopakuje. EmailLog zaznamenává poskytovatele Gmail a skutečnou adresu.

Nová sekce Firemní e-mail umožňuje samostatné připojení pro čtení a odesílání a test na zadanou adresu. Při aktivaci má Gmail přednost před Resend. Odpojení je ve stávajících Integracích. Podpora více současných odesílacích schránek záměrně není zapnutá; aplikace odmítne nejednoznačnou konfiguraci. Odstraněny příkladové adresy seepoint.cz z nastavení e-mailu.

Ověření: 20 cílených testů OAuth, tenant výběru, MIME/příloh, odmítnutí zprávy, chybějícího potvrzení a e-mailové politiky prošlo. TypeScript a tenant-security guard prošly. Prohlížeč na prvním Preview odhalil chybějící kontext firmy v nové sekci; opraven explicitní kontext stránky a bezpečné získání kontextu existující přihlášené session v transportu. Živý Gmail send přes SeePoint zatím NEOVĚŘEN – účet má stále pouze readonly grant, produkční kód nezměněn. Preview zachovává zákaz běžného odesílání.

Finální Preview: https://seepoint-n6187gz8n-pavels-projects-073588fb.vercel.app, deployment dpl_Erkvev3iCyGYHFfKEoFKUPLBWnRx, READY (Next.js). Nasazeno z necommitovaného pracovního stromu, bez databázové migrace. Pod samostatným QX ADMIN ověřena stránka /settings/email: žádná chyba kontextu, pouze QX identita, Gmail správně neaktivní při readonly grantu, neutrální příkladové adresy. Screenshot reports/qx-gmail-sending-preview-2026-10-02.png. Diff check bez chyb. Vyžádáno potvrzení přechodu z Preview do produkce, protože nasazení zahrnuje dosavadní opravy auditu a ovlivní všechny organizace. Google nové oprávnění gmail.send ještě nebylo uděleno a zpráva přes novou aplikační cestu nebyla odeslána.
Implementace Gmail MIME/odesílání vychází z https://developers.google.com/workspace/gmail/api/guides/sending a rozsah oprávnění z https://developers.google.com/workspace/gmail/api/auth/scopes.

## 2026-10-02 – Schválení produkce a ochrana e-mailu SeePoint

Uživatel schválil produkční nasazení s podmínkou zachovat e-mail SeePointu. Přidána výslovná výjimka org_seepoint_default: tenantový Gmail transport se vůbec nevyhledává ani neaktivuje, nové UI se pro SeePoint nezobrazuje a connect?send=true je pro něj odmítnuto. Zachováno stávající odesílání Resend/webhook/platformní Gmail, původní interní BCC a fallback Reply-To SeePointu. Ostatní organizace platformní BCC nedostávají. Nové Gmail odesílání navíc vyžaduje sendingEnabled=true uložené pouze po explicitním OAuth send flow; starší granty samy nic nepřepnou. Nastavení AI Inboxu tento příznak zachovává.

30 cílených testů Gmail/Resend/OAuth a tenantové politiky prošlo; po doplnění ochrany kopií prošlo dalších 17 relevantních testů, typecheck a tenant-security guard. Před nasazením UI SeePointu potvrzuje ověřenou doménu seepoint.cz a Reply-To info@seepoint.cz. Produkční build zahájen s výslovným souhlasem uživatele, bez změny env proměnných a DNS.

Produkční nasazení dokončeno: dpl_9ne8kEQwpfswsCeF4bYhzLrKZShL, READY, https://seepoint.vercel.app (deployment https://seepoint-qzrdmaf87-pavels-projects-073588fb.vercel.app), build přibližně 2 minuty, Next.js 15.5.25, necommitovaný pracovní strom. Bez migrace a bez změn DNS/env. Po nasazení ověřen skutečný test původního SeePoint odesílání: UI potvrdilo odeslání z info@seepoint.cz na subert.pvel@gmail.com a Gmail konektor nezávisle potvrdil doručenou zprávu INBOX, message id 1a0fb13a7e051089, čas 2026-10-02T05:26:03Z. Reply-To info@seepoint.cz zůstalo zachované. Screenshot reports/seepoint-email-after-deploy-2026-10-02.png. Vercel logs s filtrem error za 10 minut vrátil No logs found; není to záruka neexistence všech chyb.

QX připojení pro Gmail send bylo nejprve zablokováno nedostupnou automatickou kontrolou kvůli limitu využití (akce neprovedena). Po uživatelově pokračuj ověřena obnovená dostupnost, standardní opakování přes stejný nástroj uspělo. Vybrán pouze účet qxpromotion101@gmail.com. Google zobrazuje bezpečnostní varování Google tuto aplikaci neověřil. Varování neobejito, krok předán uživateli. Screenshot reports/qx-gmail-send-consent-2026-10-02.png. Nové oprávnění gmail.send ani dokončení callbacku zatím nepotvrzeno; zpráva přes QX aplikační Gmail zatím neodeslána.

### Dokončení živého QX Gmail odesílání – 2. 10. 2026 14:06 Europe/Prague

Po uživatelově hotovo ověřen callback google=connected a aktivní odesílací schránka qxpromotion101@gmail.com v organizaci QX promotion. Z nového produkčního UI odeslána jedna testovací zpráva na výslovně povolenou adresu subert.pvel@gmail.com. UI potvrdilo odeslání. Gmail konektor nezávisle potvrdil přijetí v INBOX, message id 1a0fc827cb984d51, čas 2026-10-02T12:06:43Z (14:06:43 Europe/Prague), from qxpromotion101@gmail.com, to pouze subert.pvel@gmail.com, bez CC/BCC. Screenshot reports/qx-gmail-send-success-2026-10-02.png. V logu i cílové schránce byla již dřívější zpráva v 08:22:56, její odeslání agent v tomto kroku neprovedl; nový test ověřuje aktuální připojení po souhlasu uživatele.

Potvrzené živé výsledky: Drive upload/download s kontrolou obsahu a odmítnutím anonymního čtení, Gmail příjem do AI Inboxu, přenos a odstranění události v Planneru, Gmail odesílání přímo ze SeePointu a zachované původní odesílání SeePoint z info@seepoint.cz. Nejde o záruku funkčnosti každé stránky či všech kombinací oprávnění. Testovací nabídky nebyly odesílány, Gmail přílohy byly ověřeny automatickým MIME testem, nikoli živou nabídkou klientovi. Heslo Google zůstává to, které nastavil uživatel; agent aktuální heslo nezná.

## 2026-10-02 – Produkční QX ADMIN po nasazení Gmailu

- Sedm produkčních API kontrol prošlo: přihlášení, vlastní klient a nabídka 200; seznam organizací, existující cizí klient/nabídka a pokus přepnout na SeePoint 404. Výsledek: scratch/qx-admin-production-api-results-2026-10-02.json. Kontroly používají skutečná existující cizí ID, do výstupu nepřenášejí jejich obsah.
- V produkčním prohlížeči přihlášen samostatný testovací QX ADMIN. Dashboard nabízí pouze QX promotion, přepínač organizace je deaktivovaný, sekce Platforma SeePoint není přístupná.
- Firemní e-mail zobrazuje pouze qxpromotion101@gmail.com a dvě QX testovací zprávy; nezobrazuje doménu ani testovací zprávu kanonické firmy SeePoint.
- Členové: pouze vlastník a testovací QX ADMIN. Integrace: QX Gmail a Drive.
- Onboarding je průvodce aktivní QX organizací (3/5), nikoli správa ostatních firem.
- B2B síť: 0 partnerů, 0 ploch, žádné cizí názvy firem. UI výslovně uvádí, že jde jen o katalog; partnerství, holdy, poptávky, fotodokumentace, notifikace a vyúčtování nemají aktivní perzistentní workflow. Tyto funkce nelze označit za hotové. Katalog je navržen pro výslovně publikované MARKETPLACE plochy, proto není absolutním zákazem veškerého mezifiremního sdílení.
- Důkazy: reports/qx-admin-production-email-2026-10-02.png a reports/qx-admin-production-network-2026-10-02.png.
- Prohlížeč zůstává v testovacím QX ADMIN účtu. Nebyly odeslány další e-maily ani změněny firemní konfigurace. Audit není důkazem úplného pokrytí všech rolí, stránek a zápisových workflow.

## 2026-10-02 – Nastavení a zápis do katalogu pod produkčním QX ADMIN

- Nastavení firmy: název QX promotion; žádná cizí adresa, bankovní účet, kontakt ani logo. Skutečné fakturační údaje nejsou vyplněné; během auditu nebyly nahrazeny smyšlenými údaji.
- Systémová nastavení: prázdné ceníky a sazby. Drobnost k úpravě: components/PriceListSettings.tsx:166 obsahuje konkrétní placeholder „PROMO Lavičky Ostrava“. Nejde o načtený cizí záznam, ale doporučeno nahradit neutrálním příkladem. Zatím nezměněno a nenasazeno.
- Typy nosičů: obecný výchozí katalog. Živě vytvořena položka QX_AUDIT_20261002, následně přejmenována na „TEST QX – katalog ověřen 2026-10-02“ a deaktivována tlačítkem stavu. Obnovení stránky potvrdilo trvalý nový název a stav Neaktivní; vazby na inventář 0. Testovací položka zůstává pro dohledatelnost neaktivní. Důkaz reports/qx-catalog-write-test-2026-10-02.png.
- Produktový katalog: prázdný, žádné cizí produkty.
- Pracovní činnosti: 9 obecných činností a oborové šablony, bez cizích firemních údajů. Nastavení nebylo měněno.
- Calendar & Planner: testovací ADMIN nemá žádný připojený Google účet; připojení vlastníka se správně nezobrazuje jako jeho vlastní. Tato kontrola ověřuje seznam připojení, nikoli všechny možnosti sdílení událostí.
- Funkční omezení přímo v UI: AI doporučení v Planneru nejsou aktivní a schůzky se automaticky nepřesouvají.

## 2026-10-02 – Provozní stránky a sklad pod produkčním QX ADMIN

- Planner Dnes: prázdný plán bez cizích událostí. Tým: pouze Pavel Šubert a TEST QX – audit ADMIN. Moje úkoly: 0 interních i klientských úkolů.
- Telefonní seznam: 0 aktivních členů týmu. Zdroj app/team/page.tsx čerpá z employee, zatímco Planner z členství; QX má 2 přihlašovací členy, ale nemá zaměstnanecké profily. Nejde o zjištěný únik, ale UI nevysvětluje rozdíl a postrádá užitečný prázdný stav.
- Odvedená práce: 0 záznamů, žádní pracovníci ve filtru. Vozidla: 0 vozidel, bez cizích SPZ či názvů. Ověřeno zobrazení, nikoli celé zápisové workflow těchto modulů.
- Sklad: před testem 0 položek a pohybů. Vytvořena jasně označená položka TEST QX – audit skladu 2026-10-02, SKU QX-AUDIT-20261002, cena 0, zásoba 0, poznámka zakazující použití pro skutečné zakázky.
- Výdej 1 ks z nulové zásoby odmítnut hláškou Nedostatek materiálu na skladě. Aktuálně je k dispozici pouze 0 ks. Po zrušení formuláře a obnovení stránky položka přetrvává se zásobou 0 a pohyby 0. Důkaz reports/qx-warehouse-validation-2026-10-02.png. Testovací položka zůstává v evidenci; nebyla smazána.
- AI skladové funkce, příjem/výdej skutečného materiálu a vazba na zakázku nejsou tímto testem ověřeny.
- Dočasný limit ovládacího nástroje vyřešen po obnovení běžného přístupu; nešlo o chybu aplikace. Občasné timeouty browser ovládání byly dořešeny kontrolou aktuálního stavu, nikoli opakováním zápisu.

## 2026-10-02 – Nákupy, výroba, vyúčtování a testovací zaměstnanec

- Nákupy: 0 položek, formulář nenabízí žádné cizí zaměstnance ani zakázky. Formulář zrušen bez zápisu.
- Výroba: 0 tiskových objednávek. Formulář nabízí pouze dvě existující testovací zakázky QX, žádné cizí. Formulář zrušen, nic neobjednáno.
- Firemní vyúčtování: 0 záznamů. Osobní vyúčtování původně správně hlásilo chybějící zaměstnanecký profil.
- Dovolené před profilem: tlačítko zakázané, ale prázdný stav přesto vybízí k vložení žádosti tlačítkem nahoře. UX závada, zatím neopravena.
- Vytvořen evidenční zaměstnanec TEST QX audit ADMIN, id cmur8ts530000l804xgldp81a, e-mail existujícího testovacího QX ADMIN; checkbox Povolit přístup do aplikace ponechán vypnutý. Bez hesla, telefonu, osobních údajů, sazeb nebo finančních dokladů. Výslovná poznámka, že nejde o skutečného zaměstnance. Role evidenčního profilu Administrátor odpovídá stávající roli účtu.
- Po založení osobní vyúčtování rozpozná zaměstnance přes shodný e-mail; telefonní seznam ukazuje 1 testovacího zaměstnance; formulář volna je dostupný a nabízí pouze tento QX profil. Žádná absence nebyla uložena ani schválena.
- Nalezen nesoulad: detail zaměstnance tvrdí Účet zatím není vytvořen, přestože existuje přihlašovací účet stejného e-mailu. POST /api/employees vytváří přímou vazbu userId jen při allowAccess, kdežto osobní vyúčtování používá i e-mailový fallback. Nesoulad zatím neopraven; nepoužito tlačítko Povolit přístup ani odeslání pozvánky.
- Důkazy reports/qx-employee-profile-2026-10-02.png a reports/qx-test-employee-team-2026-10-02.png. Testovací evidenční profil zůstává aktivní pro další ověření workflow.

## 2026-10-02 – Opravy textů po auditu zaměstnaneckého profilu

- AccountAdmin nyní popisuje chybějící přímé propojení profilu s účtem, netvrdí, že účet neexistuje. Vysvětluje, že povolení přístupu může propojit existující účet a nastavit role podle zaměstnance, nebo vytvořit nový účet s pozvánkou.
- Formulář zaměstnance výslovně říká, že samotný e-mail nevytvoří ani přímo nepropojí přihlašovací účet. Automatické propojování nebylo přidáno; oprava je pouze v textu, nesoulad přímé vazby a e-mailového fallbacku zůstává architektonickou vlastností.
- Prázdné dovolené bez dostupného zaměstnance vysvětlují nutnost zaměstnaneckého profilu místo výzvy ke kliknutí na zakázané tlačítko.
- Ceník používá neutrální příklad pronájmu reklamní plochy místo PROMO Lavičky Ostrava.
- Kontroly npm run typecheck, npm run security:tenant a git diff --check prošly. Změny nemění API, data, role, e-mailový transport ani schéma databáze.
- Nasazeno do produkce: dpl_3e3H91jfJKRyKPMRQ1fQ2sCsGYkR, https://seepoint-gi51ow1y1-pavels-projects-073588fb.vercel.app, READY, alias https://seepoint.vercel.app. Produkční build prošel.
- Živé ověření detailu testovacího zaměstnance na hlavní adrese potvrdilo nový text o chybějícím přímém propojení a vysvětlení důsledků povolení přístupu. Screenshot reports/qx-account-copy-fixed-2026-10-02.png. Účet nebyl během této opravy propojován ani měněn.

## 2026-10-02 – Audit výjezdů a oprava implicitního depa

- Osobní evidence práce rozpoznává testovací zaměstnanecký profil. Formulář však vyžaduje ruční WorkTask CUID místo výběru úkolu; UX překážka zapsána, dosud neopravena. Žádný záznam práce nebyl vytvořen.
- Plán práce prázdný, bez cizích zakázek. Dispečink nabízí pouze testovacího zaměstnance QX a žádné vozidlo.
- Nález: nastavení depa nabízelo pevná města Ostrava/Praha/Brno, výchozí backend profil bez uložené konfigurace používal ostravské souřadnice 49.8346,18.2820. Nešlo o únik databázového záznamu jiné firmy, ale o nevhodné společné výchozí nastavení pro nové organizace.
- Oprava: neexistující profil vrací null; loadPlanningData odmítne výpočet bez konfigurace. UI vysvětluje nutnost nastavit vlastní depo. Odstraněna funkce defaultPlanningProfile s implicitní Ostravou.
- Formulář má povinné GPS výjezdu a návratu bez předvyplněného města. Zachovává uložený návratový bod; dříve jej při uložení přepisoval výjezdním bodem. Tlačítko umožňuje explicitně zkopírovat výjezd pro návrat.
- Nezměněny uložené databázové profily ani oprávnění. Existující uložená depa se nečistí ani nehádají.
- 53 cílených testů plánování včetně nového odmítnutí plánování bez profilu prošlo; typecheck a tenant security guard prošly.
- Nasazení dpl_2RgqHexCS2vbwLaRpEd7TAGqeMcg READY, https://seepoint-qarorygy2-pavels-projects-073588fb.vercel.app, alias seepoint.vercel.app. Produkční build úspěšný.
- Živé ověření QX: výzva k nastavení vlastního depa, plánování deaktivované, všechna čtyři GPS pole prázdná, žádná města jako předvolby. Screenshot reports/qx-depot-empty-fixed-2026-10-02.png. Žádná konfigurace depa ani trasa nebyla během ověření uložena.

## 2026-10-02 – Mobilní trasa, úkoly, nosiče a mapa

- Mobilní trasa /my-route se otevřela s prázdným stavem, žádné cizí zastávky. Neověřuje skutečné přiřazení k posádce: testovací profil nemá přímou vazbu userId a tato část ji používá; shoda e-mailu tedy není důkazem fungujícího celého výjezdu.
- Všechny úkoly: 0 interních i zakázkových úkolů. Stavové filtry stále používají technické anglické hodnoty TODO/IN_PROGRESS apod.
- Evidence nosičů: 0 nosičů; typy pouze obecné aktivní typy QX. Deaktivovaný testovací typ není v nabídce. Města, lokality a klientské filtry neobsahují cizí hodnoty.
- Obsazenost: 0 kampaní. Rychlá rezervace nabízí jen TEST QX – kontrola izolace; žádný nosič. Formulář zrušen bez zápisu. Zbylé konkrétní placeholdery Ostrava, Praha a Kampaň Jaro 2026 - Koupelny Ostrava jsou statický text, ne cizí načtené záznamy; k neutralizaci.
- Mapa: 0 nosičů i klientských hodnot. Přesto nabízí statickou regionální vrstvu Zákaz reklamy Ostrava (12 zón). Zdroj MapView.tsx ji přidává obecně. Není to důkaz úniku privátních firemních dat; jde o nepersonalizovanou regionální funkci, jejíž vhodnost a výchozí zobrazení je třeba upravit.
- Mapa a evidence obsahují implementační texty (server-side, samostatný mapový dotaz, Výchozí limit mapy není 500), které nepatří do běžného uživatelského vysvětlení. Dosud neopravováno.
- Důkaz reports/qx-map-audit-2026-10-02.png. Žádné nové rezervace, nosiče ani pracovní záznamy během této části auditu nevznikly.

## 2026-10-02 – Hlavní mapa a neutrální popisky

- MapView: prázdná mapa má obecný pohled [20,0], zoom 2; načtené nosiče nadále určují přiblížení pomocí fitBounds. Ostravská vrstva je ve výchozím stavu vypnutá a přepínač se zobrazuje pouze při vlastních načtených nosičích s městem Ostrava. Vrstva se při inicializaci již nepřidává automaticky do mapy.
- Upraveny technické popisky hlavní mapy a evidence nosičů na uživatelské vysvětlení. Zobrazovaný limit zůstal jako užitečný údaj.
- Neutralizovány placeholdery měst v obsazenosti a konkrétní kampaně Koupelny Ostrava v rezervaci a navigační nabídce.
- Kontroly typecheck, tenant security guard a git diff --check prošly. Bez změny databáze nebo API.
- Následná kontrola stále nutná: FieldSurveyMapView má podle zdrojového kódu vlastní ostravský fallback a zapnutou regionální vrstvu; CampaignLiveMap má také ostravský fallback. Tato změna opravuje hlavní MapView, nikoli všechny mapové komponenty.
- Nasazeno dpl_AVuwPD84GQ2wqawZYk3oVx96Vnv7 READY, https://seepoint-55jw54821-pavels-projects-073588fb.vercel.app, alias seepoint.vercel.app. Produkční build prošel.
- Živé DOM a vizuální ověření QX potvrdilo nový popis, žádný ostravský přepínač a odstraněné server-side popisky. Screenshot reports/qx-main-map-fixed-2026-10-02.png.
- Vizuální follow-up: při aktuální šířce prohlížeče vnořené sloupce ponechávají mapě příliš úzký prostor; upravit responzivní rozložení. CarrierFilters stále vizuálně ukazuje placeholder Např. Ostrava, který DOM snapshot v comboboxu nezahrnoval. Tyto dvě věci nejsou touto změnou opraveny.

## 2026-10-03 – Responzivní rozložení hlavní mapy

- Vnější sloupec filtrů se používá až od 2xl a má 280 px; při menší šířce jsou filtry nad mapou v několika sloupcích.
- Mapa a detail používají auto-fit podle dostupné šířky kontejneru s minimem 28rem na sloupec. Tím se eliminuje úzký mapový pruh způsobený vnořenými pevnými sloupci.
- Vnitřní lišta filtrů zalamuje ovládací prvky. Placeholder města je neutrální Název města.
- Jde o změnu zobrazení, nikoli dat či oprávnění.
- TypeScript a git diff --check prošly. Nasazení dpl_Geau93LLzKLLY6fpjMvmkxE4A4Fy READY, https://seepoint-heeoehz8j-pavels-projects-073588fb.vercel.app, alias seepoint.vercel.app.
- Živé vizuální ověření při stejné šířce okna jako nález: mapa má 458 px na šířku (dříve úzký pruh), vyhledávání a filtry jsou čitelné. Screenshot reports/qx-map-layout-fixed-2026-10-03.png. Další mobilní šířky v této části nebyly samostatně ověřeny.

## 2026-10-03 – Mapy terénního průzkumu a klientské kampaně

- Založena prázdná testovací akce TEST QX – kontrola mapy průzkumu 2026-10-03, id cmus3wxfe0001ia04w103w9no. Bez bodů, fotografií a skutečných lokalit; ponechána k ověření.
- FieldSurveyMapView: odstraněn ostravský výchozí střed, prázdná mapa má obecný pohled. Ostravská vrstva se nepřidává při inicializaci, je standardně vypnutá; přepínač je dostupný jen pro vlastní body s adresou/obcí Ostrava.
- CampaignLiveMap: odstraněn ostravský výchozí střed pro prázdnou kampaň; skutečné body a cíl nadále určují polohu a přiblížení.
- Převod průzkumného bodu na nosič: chybějící obec se již nevydává za Ostravu, pole zůstává prázdné. Backend vyžaduje city při převodu.
- Neutralizovány příklady názvu průzkumu, obce, katastru a vlastníka. Bez změn reálných záznamů a bez nových přístupových oprávnění.
- Ověření: npm run typecheck prošlo; všech 12 testů tests/field-survey.test.ts prošlo; git diff --check bez chyb (pouze upozornění LF/CRLF).
- Produkční nasazení READY: dpl_BYooCsxBZEAExqncJ4XJ8pwskCvn, https://seepoint-zc1t5hmle-pavels-projects-073588fb.vercel.app, alias https://seepoint.vercel.app.
- Živě po obnovení pod QX ADMIN ověřena prázdná mapa průzkumu: neutrální světový výřez, žádné tlačítko ostravských zón, žádné body, identita QX promotion. Snímek reports/qx-survey-map-fixed-2026-10-03.png.
- Omezení: změna klientské mapy kampaně a výchozího města převodu ověřena kódem, typy a produkčním buildem; skutečná klientská kampaň ani převod bodu na nosič v této dávce nevytvořeny. Nejde o potvrzení kompletní bezpečnosti všech stránek.
