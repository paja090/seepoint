# Jednotný tmavý design AI modulů SeePoint OS

Návrh z 18. 9. 2026 na základě přihlášené prohlídky produkčního Radaru, Inboxu, Obchodního centra, AI Obsazenosti a CRM Dashboardu. Produkční aplikace nebyla upravena. Klikací ukázka: `index.html`; používá demonstrační data a nevolá produkční API.

## Zjištění

- Menu má soudržný tmavý základ a smaragdovou aktivní položku, zatímco horní lišta a hlavní plocha jsou světlé.
- Radar používá bílé nadpisy na světlé ploše, tmavé průsvitné karty, bílé formuláře a výrazné fialové akce. Nadpis má zjevně nedostatečný kontrast.
- Inbox a Obchodní centrum mají světlé karty; CRM tmavý úvod a světlý zbytek. Obsazenost používá další variantu barevných metrik a záložek.
- Radar je obsahově dlouhý: fakt, interpretace, další krok, skórování a několik akcí se opakují u každé karty.
- V kódu je kořenový `color-scheme: light`, světlý body a společné `.input` a `.card` v `app/globals.css`. Pouhé přebarvení jednotlivých karet nestačí.

## Doporučený vizuální směr

| Role | Barva |
|---|---|
| Navigace | `#060A16` |
| Pracovní plocha | `#090F1D` |
| Karta / formulář | `#111A2B` |
| Vyvýšený povrch / hover | `#182338` |
| Oddělení ploch | `#26334A` |
| Hlavní text | `#EEF2FA` |
| Vedlejší text | `#A2AFC4` |
| Hlavní akce / aktivní navigace | `#43D9B1` s tmavým textem |
| AI interpretace | `#B9A4FF` |
| Upozornění | `#F0C477` |
| Chyba / konflikt | `#F69AA8` |

Prémiový dojem má vycházet z konzistence, čitelnosti a prostoru: jemné okraje, minimum stínů, sjednocené linkové ikony, střídmé barvy. Fialová označuje AI interpretaci, smaragdová hlavní akci. Červená patří skutečným chybám a konfliktům, nikoli vysokému obchodnímu skóre. Barvu vždy doplní srozumitelný text.

Typografie: ponechat současný font aplikace, nadpis 28–32 px, běžný text 14–16 px, metadata minimálně 12 px v produkční realizaci. Karty radius 12–16 px, ovládání 40–44 px, jednotné mezery 8/12/16/24/32 px. Ověřit kontrast běžného textu alespoň 4,5:1, viditelný focus a ovládání klávesnicí. Respektovat reduced-motion.

## Použití napříč moduly

| Modul | Navrhovaná úprava |
|---|---|
| Radar | Kompaktní příležitosti, skóre a zdroje, jeden hlavní další krok. Detail pro fakta, interpretaci, provenance a konflikty. Duplicity ve vlastní záložce s porovnáním a viditelným výsledkem akce. |
| Inbox | Stejná hlavička a filtry, tmavé řádky/karty. Jasně odlišit předmět, AI shrnutí a návrh dalšího kroku. Detail zachová původní zprávu. |
| Obchodní centrum | Klidnější seznam priorit místo stejně výrazných výstrah. Stejné štítky a tabulky jako v ostatních modulech. |
| AI Obsazenost | Jednotné metriky, tmavé seznamy, barevně jen závažnost. Asistent a detail nálezu používají společný panel. |
| CRM Intelligence | Sladit celou stránku s již tmavým úvodem. Jednotné nabídky, follow-upy, klientské karty a stavy. |
| Ostatní vložené AI funkce | Stejný vzhled pro generátor nabídek, AI obohacení klienta, rychlý úkol, skladový AI import, OCR a notifikačního asistenta. Jejich konkrétní otevřené stavy ještě vyžadují vizuální kontrolu při implementaci. |

Prototyp sdružuje moduly do ukázkové navigace pro snadné porovnání. Není to požadavek přesouvat stávající moduly mezi huby: produkční informační architekturu a oprávnění zachovat.

## Implementační postup

1. Zavést společné sémantické CSS proměnné pro plochu, text, okraj, focus, akci a stavy. Tmavý motiv aplikovat na obal AI stránek včetně horní lišty. Nedělat globální přepsání světlé `.card` a `.input`, které by poškodilo zbytek systému.
2. Rozšířit současný AppShell/ResponsiveAppShell a existující UI prvky. Sdílet hlavičku modulu, metriky, filtry, stavové štítky, AI vysvětlení a modální detail. Nevytvářet jiný navigační systém.
3. Nejprve Radar: opravit kontrast a sjednotit ovládání; kompaktní karty a detail z prototypu zavádět při zachování všech současných akcí, zdrojů a možnosti vrátit merge.
4. Stejné komponenty rozšířit na Inbox, Obchodní centrum, Obsazenost a CRM. Poté vložené AI dialogy a notifikace.
5. Ověřit desktop, mobil, rozbalené selecty, modály, loading, prázdné seznamy, dlouhé názvy, konflikty, chyby 429 a klávesnici. Chyba má být u příslušné akce; úspěch musí být vidět i v aktualizovaném seznamu.

Výchozí soubory: `app/globals.css`, `components/AppShell.tsx`, `components/ResponsiveAppShell.tsx`, `components/opportunities/*`, `components/ai-inbox/*`, `app/commercial/page.tsx`, `components/occupancy/*`, `components/crm/*`, `components/notifications/*` a jednotlivé AI dialogy. Přesný rozsah určit podle jejich sdílených komponent při realizaci.

## Hranice návrhu

Klikací ukázka demonstruje navigaci mezi pěti moduly, detail zdrojů, přepnutí na duplicity a lokální hledání. Hlavní pracovní akce zobrazují pouze informační zprávu. Není implementací funkčního backendu ani produkční změnou. Návrh nemění AI pipeline, databázi, role ani obchodní data.
