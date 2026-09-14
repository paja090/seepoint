# Audit navigace SeePoint OS

Audit původní navigace před změnou: 36 hlavních odkazů, všechny zachovány.

| Položka | Route | RBAC sekce | Modul | Hub / skupina |
|---|---|---|---|---|
| ⚡ AI Obchodní centrum | /commercial | commercial | commercial | AI Hub / AI obchod |
| 📬 AI Inbox | /ai-inbox | aiInbox | aiInbox | AI Hub / AI obchod |
| 📡 AI Obchodní radar | /sales/opportunities | clients | salesRadar | AI Hub / AI obchod |
| 📊 Nástěnka / Přehled | /dashboard | dashboard | dashboard | Obchod & CRM / Obchod |
| 📊 Analytics & Tržby | /analytics | clients | analytics | Obchod & CRM / Obchod |
| 📄 Nabídky | /offers | offers | offers | Obchod & CRM / Obchod |
| 🌐 B2B Media Network | /network | offers | network | Obchod & CRM / Obchod |
| 🎯 CRM Dashboard | /clients/dashboard | clients | crm | Obchod & CRM / CRM |
| 👥 Klienti & Adresář | /clients | clients | crm | Obchod & CRM / CRM |
| 🗺️ Mapa nosičů | /map | map | carriers | Plochy & Obsazenost / Evidence |
| 📦 Evidence nosičů | /carriers | carriers | carriers | Plochy & Obsazenost / Evidence |
| 📍 Průzkum lokalit | /mobile-surveys | navigationProjects | mobileSurveys | Plochy & Obsazenost / Evidence |
| 📅 Obsazenost ploch | /occupancy | occupancy | occupancy | Plochy & Obsazenost / Plánování |
| 🧭 Navigační reklama (VO) | /navigation | navigationProjects | navigation | Plochy & Obsazenost / Reklamní sítě & Projekty |
| 🖼️ Výstavní & Promo sítě | /projects/city-gallery | cityGallery | cityGallery | Plochy & Obsazenost / Reklamní sítě & Projekty |
| 🪧 Městský inventář & Mobiliář | /projects/city-inventory | carriers | cityInventory | Plochy & Obsazenost / Reklamní sítě & Projekty |
| 📋 Moje úkoly | /my-tasks | myTasks | myTasks | Provoz & Realizace / Moje agenda |
| ⏱️ Moje odvedená práce | /my-work-entries | myWorkEntries | work | Provoz & Realizace / Moje agenda |
| 💰 Moje vyúčtování | /my-settlements | mySettlements | settlements | Provoz & Realizace / Moje agenda |
| 🌴 Dovolená & Volno | /vacations | team | vacations | Provoz & Realizace / Moje agenda |
| 🗓️ Plán práce | /work | work | work | Provoz & Realizace / Realizace |
| 🚗 Pracovní výjezd | /work/route | work | workRoute | Provoz & Realizace / Realizace |
| 📋 Všechny úkoly | /tasks | tasks | tasks | Provoz & Realizace / Realizace |
| 🖨️ Výroba, Tisk & Grafika | /production | printProduction | printProduction | Provoz & Realizace / Realizace |
| 🛍️ Nákupy | /shopping | team | shopping | Provoz & Realizace / Interní provoz |
| ⏱️ Odvedená práce (všichni) | /work-entries | workEntries | work | Provoz & Realizace / Interní provoz |
| 💰 Vyúčtování firemní | /settlements | settlements | settlements | Provoz & Realizace / Interní provoz |
| 🚘 Vozidla a vozíky | /vehicles | vehicles | vehicles | Provoz & Realizace / Interní provoz |
| 📦 Sklad & Materiál | /warehouse | vehicles | warehouse | Provoz & Realizace / Interní provoz |
| 👤 Zaměstnanci & Tým | /employees | employees | employees | Správa / Tým & Data |
| 📥 Import dat | /import | import | import | Správa / Tým & Data |
| ⚙️ Nastavení systému | /settings | settings | — | Správa / Nastavení |
| 🏢 Nastavení firmy | /settings/company | settings | — | Správa / Nastavení |
| ✉️ Firemní e-mail | /settings/email | settings | — | Správa / Nastavení |
| 👥 Uživatelé organizace | /settings/members | settings | — | Správa / Nastavení |
| 🔌 Integrace | /settings/integrations | settings | — | Správa / Nastavení |


RBAC: každá původní položka používá canAccess(role, section) a při existující organizaci getModuleIdForPath + isModuleEnabled. Zachována i sekce vehicles pro sklad. Serverová autentizace, tenant kontext, requirePageAccess, module-policy a API autorizace se nemění.

Výjimky: /admin/organizations a /onboarding jsou dostupné ADMIN + SUPER_ADMIN bez modulového filtru. /onboarding pro ADMIN + OWNER nebo membership.roles ADMIN pouze při viditelné skupině Nastavení, stejně jako dříve.

Další původní odkazy: /profile a logout (session), /chat a /team (team / employees), mobilní /mobile-photos (navigationProjects / navigation dle requirePageAccess). Mobilní Přehled, Sklad, Moje úkoly a Výjezd nově používají serverově filtrované položky. Foto, chat a tým používají stávající module-policy. Foto a Výjezd zůstávají dostupné v draweru.

Existující AI Obsazenost (/occupancy/ai) a Realizace (/realization) nebyly v původním hlavním seznamu; nepřidáváme nové oprávnění ani odkazy, jejich podstránky zůstávají beze změny. /os je marketingová stránka, nikoli AI orchestrátor.

Oblíbené existují pouze pro skladové položky, ne pro navigaci. Rychlý přístup odkazuje podle href na filtrované položky Nástěnka, Moje úkoly a AI Obchodní centrum.

Původní mobil: fixed header + 288px výsuvný sidebar, šest spodních akcí, bez focus trapu. Nově nativní modal dialog s Escape, uzamčením scrollu a vrácením fokusu; stejné huby jako desktop. Desktop 60px rail + 232px kontextový panel; localStorage načítané až po hydrataci.

## Implementované soubory

- `lib/navigation.ts`: centrální serializovatelná konfigurace, serverový filtr, rychlý přístup a nejdelší shoda routy.
- `lib/sidebar-preference.ts`: localStorage preference přes useSyncExternalStore, bezpečný serverový snapshot a synchronizace mezi panely prohlížeče.
- `components/AppNavigation.tsx`: icon rail, kontextový panel, accordion skupiny, tooltipy, mobilní bottom nav a dialog s cyklem fokusu.
- `components/AppShell.tsx`: předání serverově filtrovaných hubů a oprávnění pro pomocné odkazy.
- `components/ResponsiveAppShell.tsx`: propojení navigace se stávajícím profilem, rolemi, notifikacemi a košíkem; obsah bez limitu 1600 px.
- `components/AppNavLink.tsx`: přesný aktivní stav z konfigurace, AI badge, Lucide ikony a focus styly.
- `components/AppTopbar.tsx`: použití serverového oprávnění pro chat a tým; ostatní funkce zachovány.
- `tests/navigation.test.ts`: regresní inventář, role a tarify, modulové overrides, onboarding, platformní výjimky a nested routes.

## Ověření

- `npm run typecheck`: úspěch, včetně závěrečného běhu po úpravách.
- `npm run lint`: bez chyb, 425 varování v celém projektu při tomto běhu.
- Závěrečný cílený lint všech 8 změněných zdrojových/testovacích souborů: 0 chyb, 4 upozornění na použití `<img>` pro logo a avatary.
- `npm test`: 665 úspěšných testů, 0 selhání, 1 přeskočený test. Následně 4 nové navigační testy úspěšně spuštěny samostatně.
- `npm run build`: úspěch, včetně generování všech 100 statických stránek.
- Browser: ověřeny skutečné navigační komponenty v izolovaném náhledu při 1440 px a mobilních šířkách 320/390/768 px. Prošly rozměry 60/232 px, nested active state, collapse/reload, rozšíření obsahu, přepínání AI, drawer, scroll lock, Tab/Shift+Tab, Escape, návrat fokusu a zavření po navigaci. Bez browserových výjimek.
- Rozsah browserového ověření: nesouvisející utility widgety byly nahrazeny testovacími adaptéry; přihlášený backendový end-to-end průchod nebyl proveden. Serverová autentizace a autorizace nejsou touto změnou upraveny.
- Snímky, logy a izolovaný ověřovací skript: `output/navigation-verification/`.

## Doladění čitelnosti a mobilní navigace

Položky používají 14px text a minimálně 44px výšku. Nadpisy skupin jsou čitelnější, bez drobných verzálek. Scrollovací plochy mají tmavé barevné schéma a úzký slate scrollbar. Odkazy rychlého přístupu se v kontextových seznamech neopakují, jejich URL a oprávnění se nemění.

Mobilní drawer má jednu úroveň accordionů pro huby. Výchozí otevřený hub odpovídá aktuální routě; otevření jiného hubu zavře předchozí. Vnitřní podnadpisy jsou na mobilu vynechány. Ve vestavěném prohlížeči ověřeno přepínání hubů, zavření draweru po navigaci a automatické otevření hubu aktuální stránky. Čtyři regresní navigační testy prošly znovu; cílený lint bez chyb (jedno upozornění na avatar `<img>`).
