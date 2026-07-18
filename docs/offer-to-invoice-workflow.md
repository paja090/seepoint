# Cílový proces: nabídka → realizace → fotodokumentace → faktura

## Zásady

- Jedna nabídka je zdroj pravdy pro klienta, termíny, plochy a odsouhlasenou cenu.
- Provozní stav plochy a časová obsazenost jsou dvě různé kontroly. Neaktivní nosič nebo plocha mimo provoz se nesmí nabídnout nikdy. Obsazená plocha se může nabídnout pouze pro termín bez kolize.
- Ceny se spravují centrálně v databázovém ceníku. Nabídka ukládá cenový snapshot, takže pozdější změna ceníku nezmění již odeslaný dokument.
- Klient dostává jeden zabezpečený interaktivní odkaz, ne přílohu jako jediný zdroj pravdy. E-mail je profesionální pozvánka s logem a CTA na nabídku.

## Obchodní a realizační workflow

1. **Koncept nabídky**
   - klient a jeho logo;
   - termín kampaně;
   - pouze aktivní nosiče a provozuschopné plochy;
   - automatické ceny z ceníku;
   - audit fotografií, GPS, kontaktu, platnosti, ceny a obsazenosti.
2. **Odesláno klientovi**
   - systém vytvoří tokenovaný odkaz a odešle značkový e-mail;
   - eviduje odeslání, otevření a reakce klienta.
3. **Přijato klientem**
   - ve stejné transakci se znovu ověří obsazenost;
   - plochy se automaticky rezervují pro nabídku;
   - vznikne požadavek na dodání grafiky a dalších podkladů.
4. **Podklady klienta**
   - klient nahraje grafiku, loga a tisková data přes stejný odkaz;
   - obchodník/produkce označí soubory jako schválené nebo požádá o opravu;
   - audit uchová verzi, čas a schvalující osobu.
5. **Plán realizace**
   - z přijaté nabídky vznikne jeden `WorkOrder` s položkou pro každou plochu;
   - podle ceníkových položek se automaticky vytvoří úkoly: tisk, instalace, kontrola a deinstalace;
   - úkoly mají termín, odpovědnou osobu a vazbu na nabídku i plochu.
6. **Realizace**
   - pracovník dokončí úkol a nahraje povinnou instalační fotografii;
   - nabídka/kampaň je kompletní až po fotodokumentaci všech ploch.
7. **Předání klientovi**
   - klient dostane odkaz na galerii realizace;
   - systém eviduje odeslání fotodokumentace.
8. **Fakturace**
   - klientská faktura se vytvoří z odsouhlaseného cenového snapshotu nabídky;
   - položky faktury přesně kopírují pronájem, tisk, instalaci, deinstalaci a služby;
   - stav faktury: koncept → vystavena → odeslána → zaplacena.

## Ceník

Centrální `OfferPriceRule` má kategorie:

- `RENTAL` – pronájem podle typu média; výchozí cena plochy může pravidlo přepsat;
- `PRINT` – tisk/výroba podle typu média a počtu kusů;
- `INSTALLATION` – instalace za plochu nebo paušál;
- `REMOVAL` – deinstalace za plochu nebo paušál;
- `SERVICE` – grafika, doprava, expresní příplatek a další služby.

Každá sazba určuje typ média, jednotku, cenu bez DPH, způsob výpočtu a zda se má přidat automaticky. Obchodník vidí předvyplněnou kalkulaci a řeší pouze výjimky nebo slevu.

## Potřebné datové vazby pro další etapu

- `WorkOrder.offerId` – jednoznačný původ realizace;
- `ClientAssetRequest` a `ClientAsset` – požadavky a verzované grafické podklady;
- `OfferDelivery` – předání fotodokumentace klientovi;
- samostatná klientská faktura navázaná na `Offer`, protože současný model `Invoice` slouží vyúčtování pracovníků;
- auditní události pro rezervaci, podklady, vytvoření práce, dokončení realizace, odeslání fotek a faktury.
