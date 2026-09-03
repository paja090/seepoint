# Partnerská síť — plán bezpečného dokončení

Datum: 27. 8. 2026

## Výchozí stav

Modul je bezpečný jako read-only pilotní katalog. Vlastní organizace vidí svůj inventář podle své síťové viditelnosti; cizí organizace vidí pouze položky explicitně publikované jako `MARKETPLACE`. Kontaktní údaje cizích organizací nejsou veřejným katalogem. Transakční capability zůstává vypnutá, protože pro ni zatím neexistuje perzistentní doménový model.

## Etapa 1 — partnerství a řízená viditelnost

- Model `NetworkPartnership` s oběma organizacemi, stavem `REQUESTED | ACTIVE | SUSPENDED | TERMINATED`, iniciátorem, časovými údaji a auditní stopou.
- Jedinečnost neuspořádané dvojice organizací a zákaz partnerství organizace se sebou samou.
- Pozvání, přijetí, pozastavení a ukončení pouze uživatelem s příslušným oprávněním.
- `PARTNER` inventář zpřístupnit jen aktivnímu partnerovi; `SHARED` dostane výslovná pravidla nebo se do jejich schválení nebude používat.
- Kontaktní údaje vracet až aktivním partnerům a pouze v nezbytném rozsahu.

## Etapa 2 — poptávka, nabídka partnera a atomická blokace

- Modely `NetworkDemand`, `NetworkBid` a `NetworkHold` s tenant vlastníkem, stavovým automatem, dobou expirace a auditní stopou.
- Každá změna stavu musí mít povolený přechod, oprávnění a idempotency key.
- Vytvoření blokace provádět v databázové transakci s kontrolou překryvu termínu; dvě souběžné žádosti nesmějí potvrdit stejnou plochu.
- Expirace blokací řešit opakovatelnou úlohou, která je bezpečná při retry a zanechá auditní záznam.
- Cena a měna se při potvrzení uloží jako neměnný snapshot, nikoli jen jako odkaz na aktuální ceník.

## Etapa 3 — realizace a proof

- Model `NetworkProof` navázaný na potvrzenou blokaci, s verzemi, stavem revize a identitou odesílatele i schvalovatele.
- Fotografie ukládat privátně; stahování povolit jen oběma smluvním stranám a oprávněným auditorům.
- GPS, čas pořízení a další metadata validovat na serveru a uchovat původní hodnoty i historii rozhodnutí.
- Zamítnutí musí vyžadovat důvod; nové podání nesmí přepsat předchozí důkaz.

## Etapa 4 — clearing a doklady

- Neměnná účetní kniha `NetworkSettlement` a položky settlementu odvozené pouze ze schválených realizací.
- Čísla dokladů generovat serverově z řízené sekvence. Žádné identifikátory ani PDF se nesmí vyrábět pouze v klientovi.
- Výpočet provize, DPH, měny a zaokrouhlení centralizovat do jedné testované doménové služby.
- Export, vystavení dokladu a označení úhrady musí být idempotentní a auditovatelné; ruční zásah vyžaduje důvod.

## Etapa 5 — notifikace a provoz

- Doménové události zapisovat do outboxu ve stejné transakci jako obchodní změnu.
- Doručení řešit s retry, deduplikací a dead-letter stavem; selhání notifikace nesmí vrátit dokončenou obchodní transakci.
- Přidat metriky pro chyby, expirace, konflikty blokací, nedoručené události a dobu jednotlivých stavů.
- Feature flag zavádět po organizacích a etapách; globální `true` použít až po pilotu a vyhodnocení.

## Bezpečnostní pravidla

- Každý dotaz i zápis musí být omezen tenantem a ověřit účast organizace v konkrétní transakci.
- Veřejný katalog nesmí obsahovat neveřejné kontakty, interní ceny, důkazy ani historii.
- Zápisové endpointy musí validovat vstup, oprávnění, aktuální stav, idempotency key a ochranu proti CSRF/replay podle použitého transportu.
- Auditní záznamy musí obsahovat aktéra, organizaci, akci, předchozí a nový stav, čas a korelační ID; nesmí obsahovat tajné hodnoty.
- Fotografie a exporty používat časově omezené podepsané odkazy, nikoli trvale veřejné URL.

## Minimální akceptační test před pilotem

1. Organizace A požádá B o partnerství; B je přijme a teprve poté uvidí `PARTNER` inventář a povolené kontakty.
2. B vytvoří poptávku, A podá nabídku a B ji přijme.
3. Dva souběžné pokusy o stejný termín skončí jednou potvrzenou blokací a jedním konfliktem.
4. A nahraje privátní proof, B jej jednou zamítne a opravenou verzi schválí; historie zůstane zachována.
5. Settlement vznikne právě jednou, částky souhlasí a opakování stejného požadavku nevytvoří další doklad.
6. Obě organizace vidí jen své transakce; třetí tenant nedostane data ani při znalosti ID.
7. Výpadek doručovací služby neztratí událost a retry nevytvoří duplicitní notifikaci.
8. Vše projde automaticky i ručně v Preview se dvěma oddělenými organizacemi a bez chyb v runtime logu.

## Doporučený první implementační krok

Začít pouze etapou 1: schválit význam stavů a viditelností, přidat migraci a serverové API partnerství, pokrýt tenant/RBAC testy a nasadit za per-organizačním flagem do Preview. Poptávky a clearing na tuto vrstvu nenapojovat, dokud není izolace partnerství ověřená dvěma tenanty.
