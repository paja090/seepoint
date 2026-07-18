# Rozdělení nabídek podle firemních projektů

## Současný stav PR #30

- `Offer` je společná obchodní hlavička a obsahuje klienta, stav, platnost, poznámky, audit, veřejný token a finanční součty.
- `OfferItem` je pevně a povinně svázán s `AdvertisingSurface`. Tento model je správný pro standardní média, jejich obsazenost a převod do `Occupancy`, ale není vhodný pro plánované navigační body.
- Dostupnost a kolize jsou kontrolovány serverově nad konkrétními `surfaceId` a termíny. Tato logika zůstává pouze u `STANDARD_MEDIA`.
- Veřejná klientská nabídka, historie, token a stavový automat jsou použitelné jako společné schopnosti všech typů nabídky.
- Mapa používá Leaflet a OpenStreetMap. Lze znovu použít technický základ, nikoli model nosiče.
- Současné „balíčky“ ve wizardu jsou pouze výběrová pomůcka nad existujícími plochami; nemají databázovou definici ani auditovatelný cenový snapshot.

## Cílový model

Společný `Offer` dostane bezpečný `offerType` s výchozí hodnotou `STANDARD_MEDIA`. Existující záznamy tak nevyžadují destruktivní backfill.

- `STANDARD_MEDIA`: nadále používá `OfferItem -> AdvertisingSurface`; jako doplněk může nabídka obsahovat snapshot použitého balíčku.
- `NAVIGATION`: používá explicitní `NavigationOffer` a `NavigationPoint`. Bod má vlastní GPS a nevyžaduje nosič; `carrierId` je pouze volitelná budoucí vazba.
- `CITY_GALLERY`: používá explicitní `CityGalleryOffer`, volitelně napojený na `CityGalleryProject`. Základ projektu počítá s lokalitou, termínem a budoucím rozšířením, ale nevymýšlí kurátorský workflow.

Referenční integrita je řešena normálními Prisma relacemi 1:1 a 1:N. Nejsou použity polymorfní cizí klíče ani druhá databáze.

## Migrace

Migrace je aditivní:

1. vytvoří enumy typů a stavů,
2. přidá `Offer.offerType NOT NULL DEFAULT 'STANDARD_MEDIA'`,
3. vytvoří navigační, City Gallery a balíčkové tabulky,
4. přidá pouze nullable vazbu balíčkového snapshotu na existující `OfferItem`,
5. nemaže ani nepřepisuje existující nabídky, položky, nosiče, plochy nebo obsazenost.

## Routy a komponenty

- `/offers/new` – volba typu nabídky.
- `/offers/new/standard` – stávající wizard standardních médií.
- `/offers/new/navigation` – samostatný navigační formulář a mapa bodů.
- `/offers/new/city-gallery` – jednoduchý formulář nabídky Galerie venku.
- `/projects/navigation` – vstup do projektu Navigace.
- `/projects/city-gallery` – základní přehled City Gallery.
- API jsou oddělena podle domény; každé znovu ověřuje session a oprávnění.

## Pořadí implementace a rizika

1. Typ nabídky a explicitní modely bez změny stávající standardní logiky.
2. Navigační koncepty a editace bodů; bez převodu do `Occupancy`, protože body nejsou plochy.
3. Databázové balíčky, které vždy materializují konkrétní `OfferItem`; kolize proto dál ověřuje stávající serverová logika.
4. Minimální City Gallery projekt a nabídka.

Největší riziko je omylem spustit standardní kontroly a převod do obsazenosti nad navigační nebo galerijní nabídkou. Serverové služby proto musí větvit podle `offerType` a převod do `Occupancy` výslovně povolit jen pro `STANDARD_MEDIA`.
