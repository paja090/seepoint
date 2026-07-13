# Audit a integrační mapa modulu obchodních nabídek

Datum auditu: 13. 7. 2026

Výchozí větev: `main` (`e5e95fb`)

Cílová větev: `feature/complete-offers-module`

## Nalezené frontendové větve

1. `origin/v0/seepoint-proposal-page-9bba62ca` obsahuje původní v0 prezentační návrh v `app/proposal/page.tsx`, komponentách `components/proposal/*`, `lib/proposal-data.ts` a statických obrázcích `public/proposal/*`.
2. `origin/advertising-proposal-experience` je navazující a pro integraci důležitější větev. Obsahuje veřejnou nabídku `app/offer/[token]`, interní preview, `components/offer/*`, `CarrierPreviewCard`, `MediaMix`, `OfferProposal` a širší sales workflow včetně `CampaignWizard`, `CrmClientDetail`, planneru, pricingu, approval a conversion obrazovek.

Obě větve jsou od `main` oddělené a nebyly sloučené. Druhá větev používá vizuální jazyk původního v0 proposal, ale rozšiřuje jej o celý mockovaný obchodní proces.

## Stav v0 / advertising frontendů před integrací

- Prezentační části: hero, statistiky, media mix, karty nosičů, mapa, kalkulace, reference/case studies, kontakt, CTA a veřejný header/footer.
- Mock data: veškerá data veřejné nabídky pocházela z `lib/mock-offer-data.ts`; CRM, pipeline, wizard, planner, pricing, approval, feedback, conversion a success obrazovky z `lib/mock-sales-data.ts`.
- Nefunkční akce: wizard pouze měnil lokální React state a přecházel na další mock route; přijetí, zamítnutí, dotaz, pricing, schválení, převod, stažení PDF a sdílení nevolaly žádné produkční API.
- Veřejná route používala čitelný mock token a neověřovala hash v databázi.
- Reference a case studies byly smyšlená mock data a nesměly být publikovány jako skutečné reference SeePOINT.

## Stav backendu na main před integrací

- Existovaly `Offer`, `OfferItem`, `Client`, `AdvertisingCarrier`, `AdvertisingSurface`, `Occupancy`, `Photo` a `User`.
- `GET/POST /api/offers` uměly seznam a vytvoření nabídky, databázová funkce přijímala pole položek, ale UI posílalo vždy jedinou plochu.
- Kontrola kolizí rozlišovala `OCCUPIED`, `RESERVED` a `NEGOTIATION`, ale vytvoření nabídky blokovalo jen `OCCUPIED`; `RESERVED` tedy představovalo chybu integrity.
- Cena se sčítala přes JavaScript `number` a nebyl oddělen základ, sleva, DPH ani cena s DPH.
- `createdBy` bylo přijímáno z klientského payloadu a `OfferBuilder` posílal natvrdo `SALES`.
- Odkaz Detail vedl zpět na `/offers`; nebyly detail/edit/public routes ani řízené stavové akce a převod.
- Sekční RBAC povoloval offers pouze `ADMIN` a `SALES`; očekávaný přístup `MANAGER` chyběl.

## Integrační rozhodnutí

- Vizuální struktura `OfferProposal`, `CarrierPreviewCard`, `MediaMix`, `PricingSummary`, mapy a CTA byla znovu použita jako předloha pro sjednocené `ProposalView`, `OfferMap` a veřejné akce.
- Mock datové kontrakty nebyly přeneseny. Nový view model vzniká pouze ze serverově načtených Prisma dat.
- `CampaignWizard` byl funkčně převeden na jediný `OfferWizard` pod `/offers/new` a `/offers/[id]/edit`.
- Starý `components/OfferBuilder.tsx` byl odstraněn; `/sales/new` ani další paralelní creator nebyl přenesen.
- Mock reference a case studies nebyly převzaty. Veřejný výstup je připraven tak, aby se budoucí ověřené reference daly doplnit samostatným modelem.
- PDF není součástí tohoto PR. Webový výstup a jeho serverový view model jsou jednotný budoucí zdroj pro PDF renderer.

## API a oprávnění po integraci

- Interní seznam, vytvoření, detail, editace, bezpečná archivace, duplikace, odeslání, přijetí, zamítnutí, expirace, publikace tokenu, kontrola dostupnosti a převod na rezervaci/obsazenost.
- Veřejné čtení a odpověď pouze přes dlouhý náhodný token, z něhož je v DB uložen SHA-256 hash.
- Veřejné fotografie jsou dostupné pouze pokud patří k ploše nabídky a mají `isClientVisible`; Google Drive identifikátor ani token se klientovi neposílá.
- `ADMIN` a `MANAGER` mohou spravovat všechny nabídky a provést převod. `SALES` spravuje vlastní nabídky a vidí i historické nabídky bez vlastníka. Ostatní role nemají sekční přístup.

## Databázové rozhodnutí a rizika

- Migrace je aditivní: rozšiřuje `Offer`/`OfferItem`, přidává `OfferEvent`, vlastnické vazby na `User` a unikátní `(offerId, surfaceId)` pro idempotentní převod.
- Žádná produkční migrace nebyla spuštěna a nebylo použito `prisma db push`.
- Jediný záměrný `DROP` je změna existujícího FK constraintu `Offer_clientId_fkey` z `CASCADE` na `RESTRICT`; nedochází k `DROP TABLE`, `DROP COLUMN`, `DELETE` ani `TRUNCATE`.
- Unikátní index `Occupancy(offerId, surfaceId)` může selhat, pokud produkční data už obsahují duplicitní převody stejné nabídky a plochy. Před deploy migrace je nutný read-only preflight dotaz na duplicity.
- Historické nabídky zůstanou bez `createdByUserId`; aplikace je pro SALES považuje za legacy přístupné a nové zápisy už vždy používají session uživatele.

## Ruční testovací checklist

- [ ] ADMIN/MANAGER/SALES otevře `/offers`; WORKER/TECHNICIAN je odmítnut.
- [ ] Wizard založí klienta, vybere více ploch a zachová data při průchodu sedmi kroky.
- [ ] `OCCUPIED` a `RESERVED` zastaví uložení i odeslání.
- [ ] `NEGOTIATION` vyžaduje checkbox a potvrzení se uloží.
- [ ] Kalkulace se po uložení shoduje s preview včetně slev a DPH.
- [ ] Koncept jde upravit a duplikovat; odeslanou nabídku už upravit nelze.
- [ ] Stavové akce odmítnou nepovolené přechody.
- [ ] Publikace zobrazí jednorázově nový veřejný URL; po rotaci starý URL přestane fungovat.
- [ ] Veřejná nabídka neobsahuje interní poznámku, interní ID, rozpočet ani soukromý e-mail autora.
- [ ] Veřejná fotografie bez `isClientVisible` vrátí 404.
- [ ] Klient může ze stavu SENT přijmout, odmítnout nebo položit dotaz; opakovaný přechod je odmítnut.
- [ ] ADMIN/MANAGER převede ACCEPTED nabídku atomicky na RESERVED/OCCUPIED; druhé spuštění je idempotentní.
- [ ] Konflikt vzniklý těsně před převodem způsobí rollback bez částečných Occupancy záznamů.
- [ ] Filtry listu fungují pro klienta, stav, obchodníka, média, cenu, vytvoření i platnost.

## Samostatný PDF úkol

PDF má používat stejný veřejný serverový view model a stejná Decimal pole jako `ProposalView`. Navazující úkol musí vybrat renderer kompatibilní s Vercel runtime, vložit font s českými znaky, otestovat zalamování karet/mapy a nesmí kopírovat finanční logiku ani posílat data externí PDF službě.
