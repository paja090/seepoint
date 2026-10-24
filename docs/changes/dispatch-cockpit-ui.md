# Audit a redesign existujícího Dispečinku práce

## Výchozí stav ověřený 23. 10. 2026

PR #475 je otevřený draft. Jeho větev fix/dispatch-planning-consistency i origin ukazovaly na 75a9eba9cae54355c8bc176a04b0822ea39bdb8a. Proti origin/main (20de662) byla 7 commitů napřed a 0 pozadu. Produkce Vercel: 20de662, READY; poslední preview: 75a9eba, READY. CI posledního preview selhalo na starším formátu planningInputSnapshot bez jobs. Oprava zde používá i uložené zastávky a zachovává kontrolu aktivních modulů. Testovací organizace terénní realizace nyní výslovně zapíná tento modul; doplněn negativní test jeho vypnutí.

Redesign vzniká pouze lokálně na samostatné větvi refactor/dispatch-cockpit-ui nad aktuálním PR. Žádná novější implementace nebyla nahrazena. Žádný merge, push ani nové nasazení. Nesouvisející lokální marketingové změny nejsou součástí úpravy.

| Funkce | Existuje | Použitelná komponenta | Úprava |
| --- | --- | --- | --- |
| Fronta a výběr práce | Ano | DispatchBoard, dispatchPlanningLinks | Třípanelové rozložení, vyhledávání, zdrojové filtry, hromadný výběr |
| Zadání práce | Ano | DispatchIntake a stávající POST | Boční panel, uzamčení zavření během ukládání |
| Plánování a schválení | Ano | WorkRoutePlanner, field-planning | Odkazy do rozšířeného režimu, pravidla nezměněna |
| Mapa | Ano | RouteMap | Neplánované body ze skutečných souřadnic; kliknutí otevírá detail |
| Průběh realizace | Ano | myRoute | Výslovný rozsah všech posádek pouze pro správce/manažera; pouze čtení |
| Týden | Ano | WeekView a Timeline | Uložené výjezdy na sedm dní, bez editace času a bez drag-and-drop |
| Časová osa pracovníků | Ano | Timeline | Seskupení skutečných schválených výjezdů podle pracovníků |
| Mobilní realizace | Ano | MyRouteView | Beze změny UI a výchozího rozsahu dat |

## Rozsah implementace

DispatchBoard zůstává jediným dispečinkem. Obsahuje horní lištu, datum, Dnes/Týden/Mapa, Přidat práci, kompaktní souhrn, frontu/mapu/výjezdy a volitelnou časovou osu. Detail práce odkazuje na původní úplný detail a podklady. Plánování používá původní dispatchPlanningLinks, schvalování a pokračování používají původní API.

Nový DispatchDrawer je prezentační obal s nativním dialogem (focus trap, Escape, návrat fokusu). Nový lib/dispatch/presentation.ts pouze promítá existující plány do identit mapy a dat WeekView/Timeline a převádí skutečné stavy realizace na počty. Neprovádí plánování ani zápisy. Přidání crewId do výsledku myRoute umožňuje jednoznačný průběh bez párování podle jmen. Výchozí chování mobilního čtení zůstává stejné; širší rozsah vyžaduje roli ověřenou službou.

Žádné nové modely, tabulky, migrace, API pro plánování nebo druhý mapový engine. WorkRoutePlanner a MyRouteView nebyly vizuálně přepsány. Nezměnilo se fotografování, materiálové přesuny, idempotence ani transakce.

## Omezení

- Přehled se aktualizuje při načtení nebo tlačítkem Obnovit; není to živý stream.
- Týdenní přehled je pouze čtení sedmi dní od zvoleného data. Časy pocházejí z uloženého plánu, nikoli z automatického přesunu událostí.
- Časová osa ukazuje výjezdy, nikoli veškerou pracovní dostupnost, dovolené či soukromé kalendáře. Ty zůstávají v Planneru a ve schvalovacích kontrolách.
- KPI rozlišují práce ve frontě a dokončené zastávky. Pokud průběh nelze načíst, zobrazuje se nedostupný údaj, nikoli odhad. Počty v týdnu neimitují denní realizaci.
- Přehled zachovává limit 500 terénních bodů a 100 plánů (pro vybrané období); upozornění na limit je viditelné. Čtení průběhu využívá existující myRoute a při velkém počtu posádek může být náročnější; v týdenním pohledu se nespouští.
- Mapové podklady vyžadují připojení. Při chybějících souřadnicích zůstává dostupná fronta a úplný detail.
- Izolace preview databáze není potvrzená. Prohlížečové testy používají výhradně lokální fixtures; žádné zápisy do preview nebo produkce. Volitelné testy externího Postgresu jsou vypnuté.

## Ověření

Nové tests/dispatch-presentation.test.ts ověřují identity více plánů, zachování tras a termínů, readonly kalendář, skutečný průběh a oprávnění k rozsahu posádek. Nové tests/dispatch-cockpit.browser.mjs ověřují desktop/mobil, skutečnou RouteMap se simulovanými dlaždicemi, filtry, boční panel a klávesnici, smíšený výběr, týden a časovou osu. Stávající test zadání upravuje pouze jméno tlačítka na Přidat práci. Screenshoty testovacího UI jsou v tmp/dispatch-cockpit-desktop.png a tmp/dispatch-cockpit-mobile.png; nejde o produkční data.
### Výsledky ověření 24. 10. 2026

- Čistá kopie commitu d08bb86: 1124 testů, 1119 úspěšných, 0 selhání, 5 přeskočených volitelných testů; návratový kód 0. Externí databázové testy nebyly zapnuté.
- TypeScript bez emitování a cílený ESLint: úspěch.
- Prohlížečové scénáře dispatch-cockpit, dispatch-queue, dispatch-planning a mobile-route-focus: úspěch. Desktopový a mobilní screenshot byl vizuálně zkontrolován.
- První úplné sestavení čisté kopie zkompilovalo aplikaci, ale kontrola typů narazila na výchozí 2GB heap Node (exit 134). Opakování s procesním NODE_OPTIONS 4 GB prošlo kompilací, kontrolou typů a generováním 138 statických stránek. Kvůli výraznému paměťovému tlaku na 8GB počítači byl kontrolní proces ukončen před potvrzením úspěšného konce buildu. Úplný build tedy není ověřený; před sloučením je potřeba jeho dokončení na prostředí s dostatečnou pamětí. Produkční konfigurace zůstává beze změny.
- Ve sdíleném pracovním adresáři existují nesouvisející marketingové a produktové změny; nejsou součástí commitu ani čistého ověření.
### Kontrola prostředí před testovacím nasazením

Dne 24. 10. 2026 byl projekt a poslední preview ověřen pouze čtením. Vercel konektor odmítl přístup k metadatům proměnných (403); autentizované CLI pro propojený projekt jejich názvy a cílové prostředí načetlo bez tajných hodnot. Preview má obecné databázové proměnné a výjimky pro jiné větve, ale pro refactor/dispatch-cockpit-ui nebyla doložena vlastní databáze. Některé Google Drive, OAuth, e-mailové a další integrační proměnné mají společný rozsah Preview a Production. Z metadat nelze potvrdit samostatné úložiště nebo izolovaná data. Žádný zápisový test proto neproběhl ve vzdáleném preview. Před takovým testem je nutné samostatně ověřit databázi, úložiště a vypnout či izolovat externí integrace. Žádné proměnné nebyly změněny a nebylo provedeno nasazení.
### Dokončené sestavení 24. 10. 2026

Standardní next build čisté kopie commitu d08bb86 následně dokončil všechny fáze a skončil návratovým kódem 0. Použit byl pouze procesní NODE_OPTIONS=--max-old-space-size=3072, existující cache a lokální testovací DATABASE_URL/DIRECT_URL; konfigurace aplikace nebyla změněna. Prošla kompilace, kontrola typů, generování 138 statických stránek, optimalizace a build traces. Výstup obsahuje /work/dispatch, /api/work/dispatch i /my-route. Log: tmp/dispatch-cockpit-final-build.log. Dřívější omezení nedokončeného buildu je tím vyřešené. Upozornění na dva lockfiles se týká umístění čisté kopie uvnitř pracovního adresáře. Tento výsledek není potvrzením vzdáleného end-to-end testu s databází; izolace preview zůstává neověřená. Žádný push, merge ani nasazení nebyly provedeny.

Po následném výslovném souhlasu uživatele vzniklo izolované testovací nasazení. Aktuální výsledek a oddělení prostředí popisuje [dispatch-isolated-preview.md](dispatch-isolated-preview.md). Ostrý projekt zůstal beze změny.
