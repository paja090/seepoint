# Audit a integrační mapa modulu obchodních nabídek

Datum aktualizace: 16. 7. 2026

Zdroj vizuálu: `origin/advertising-proposal-experience` (`f497687`)

Cílová větev / PR: `feature/complete-offers-module`, PR #30

Společný základ: `2276cc3985b08c448cfb4519dd8c9c7cf45a5aac`

## Kontrolní brána

- PR #30 je otevřený draft a jeho pracovní větev je `feature/complete-offers-module`.
- Pracovní větev byla před změnami čistá a sledovala `origin/feature/complete-offers-module`.
- `origin/advertising-proposal-experience` existuje a obsahuje 5 unikátních commitů; PR #30 obsahuje 51 unikátních commitů proti společnému základu.
- V0 mění 64 souborů, PR #30 238 souborů a 32 cest bylo změněno v obou větvích.
- Přímý merge není bezpečný: 21 souborů má skutečný obsahový konflikt, hlavně `app/offers/page.tsx`, shell aplikace a `components/offer/*`.
- PR #30 obsahuje novější Prisma model, migraci, API, RBAC, tokeny, audit, fotografie, serverové finanční výpočty a transakční převod. V těchto oblastech je zdrojem pravdy PR #30.

## Srovnávací tabulka

| Oblast | Větev v0 | PR #30 před tímto auditem | Rozhodnutí |
| --- | --- | --- | --- |
| Dashboard | Vizuálně hotový šestisloupcový pipeline dashboard nad mock daty | Stejná struktura napojená na skutečné nabídky a události | Zachovat PR #30, dolaďovat pouze odchylky vzhledu |
| Průvodce | Sedm kroků, třísloupcový layout, lokální React state, nefunkční založení klienta | Sedm kroků a stejné rozložení, reálný klient, API, plochy a uložení | Zachovat backend PR #30 a doplnit chybějící UX v0 |
| Výběr ploch | Mapa byla dekorativní, seznam i balíčky byly mock | Reálná OSM mapa a až 2 000 DB ploch, ale pouze textové hledání a bez stránkování | Doplnit filtry, stránkování, hromadný výběr, detail a lightbox |
| Plánování | Hotový vizuál časové osy a kolizí nad mock daty | Stejný vizuál nad reálnými termíny a serverovými kolizemi | Zachovat PR #30 |
| Cenotvorba | Vizuální řádky a lokální procentní sleva | Serverový Decimal výpočet, ale UI zpřístupňovalo jen cenu a procentní slevu | Zpřístupnit množství, jednotku, pevnou slevu, období, poznámky a hromadné ceny |
| Schválení | Checklist a chybějící podklady byly mock | Checklist vzniká z klienta, GPS, fotografií, kalkulace a kolizí | Zachovat PR #30 |
| Klientská nabídka | Vizuálně kompletní, ale s čitelným mock tokenem, falešnými statistikami a nefunkčními akcemi | Stejná komponentová struktura, hash token, veřejná API, skutečné fotografie a ceny | Zachovat PR #30; žádné falešné reference ani případové studie |
| Přijetí / odmítnutí | Pouze dialog a lokální stav | Veřejná tokenová akce, expirace, stavový automat a audit | Zachovat PR #30 |
| Převod na obsazenost | Prezentační progress obrazovka bez zápisu | Transakční, idempotentní převod s novou kontrolou kolizí | Zachovat PR #30; vizuální progress je volitelné další vylepšení |
| Datový model | Mock TypeScript objekty | `Client`, `Offer`, `OfferItem`, `AdvertisingCarrier`, `AdvertisingSurface`, `Occupancy`, `OfferEvent` | Výhradně aktuální Prisma model PR #30 |
| RBAC | Žádné reálné serverové oprávnění | ADMIN/MANAGER globálně, SALES vlastní/legacy, ostatní bez přístupu | Výhradně PR #30 |
| PDF | Tlačítko bez produkčního rendereru | Tisková verze přes `window.print()` | Zachovat jednotný webový view model; samostatný PDF renderer až po bezpečném výběru runtime |

## Obrazovky a konfliktní soubory

V0 přidalo `/sales`, `/offer/[token]` a interní `/offers/preview`. Tyto paralelní routy se nepřenášejí. Jediný systém zůstává pod:

- `/offers`
- `/offers/new`
- `/offers/[id]`
- `/offers/[id]/edit`
- `/offers/[id]/planner`
- `/offers/[id]/pricing`
- `/offers/[id]/approval`
- `/offers/[id]/preview`
- `/proposal/[token]`

Vizuální komponenty `OfferProposal`, `OfferHero`, `OfferStats`, `OfferMapPreview`, `MediaMix`, `CarrierShowcase`, `PricingSummary`, `ConditionsSection`, `ContactCard`, CTA a veřejný header/footer byly zachovány a jejich datový kontrakt byl převeden z mocků na `ProposalOffer` vytvořený z `OfferView`.

## Funkční stav po auditu

### Hotové v PR #30

- vytvoření a editace konceptu,
- založení klienta přes autorizované API,
- individuální položky, slevy, DPH a serverový Decimal přepočet,
- serverová kontrola `OCCUPIED`, `RESERVED` a `NEGOTIATION`,
- odeslání, publikace/rotace tokenu, přijetí, odmítnutí, dotaz a expirace,
- duplikace, archivace, historie událostí a audit,
- transakční převod přijaté nabídky na obsazenost,
- klientské fotografie pouze pro plochy nabídky a pouze s `isClientVisible`,
- tisková verze klientské nabídky.

### Doplněno při tomto auditu

- hledání ploch přes kód, název, ulici, adresu, město, lokalitu a popis,
- filtry typu média, evidenčního stavu, výsledku kontroly dostupnosti a přítomnosti GPS,
- stránkování velkého seznamu po 24 položkách,
- hromadný výběr a odebrání právě zobrazených ploch,
- synchronizovaný výběr ploch z reálné mapy,
- detail plochy v modálním okně a zvětšení skutečné fotografie,
- množství, jednotka, období, jednotková cena, procentní i pevná sleva, skupina a poznámky položky,
- hromadné nastavení jednotkové ceny a slevy,
- validované přechody mezi kroky,
- debounced automatické uložení existujícího konceptu,
- automatická serverová kontrola kolizí po změně výběru nebo termínu,
- odstranění tří natvrdo zadaných demo případových studií a jejich falešných statistik.

## Bezpečnostní a databázová rozhodnutí

- Nevzniká druhá databáze, Prisma client ani paralelní tabulka.
- Mock data z `lib/mock-offer-data.ts` a `lib/mock-sales-data.ts` se nevracejí.
- Klientský výstup nevystavuje interní poznámku, soukromé identifikátory ani neveřejné fotografie.
- Klientský finanční náhled je pouze pomocný; před uložením je vždy znovu normalizován a přepočítán serverem přes Prisma `Decimal`.
- Produkční migrace se v rámci této integrace nespouští a `prisma db push` se nepoužívá.
- Migrace nabídek je aditivní. Před pozdějším deployem zůstává povinný read-only preflight duplicit `Occupancy(offerId, surfaceId)`.

## Zbývající ověření

- kompletní lint, typecheck, testy, Prisma validate/generate a produkční build,
- vizuální kontrola desktop/mobil proti v0,
- E2E vytvoření → plánování → ceny → kontrola → publikace → klientská reakce → převod nad izolovanými testovacími daty,
- runtime ověření až po potvrzení, že dostupný `DATABASE_URL` patří bezpečnému testovacímu/preview prostředí.
