# Pět pilotních lekcí

Společný stav všech: **MEDIA_PENDING**, obsah vychází z kódu, **BROWSER_UNVERIFIED**, poslední runtime ověření: **žádné**, verifiedAt=null. Revize návrhu 1, kontrola kódu 8.–9. 10. 2026. Uvedené texty tlačítek jsou pouze tam, kde byly nalezeny v komponentě; ostatní kroky popisují účel a vyžadují doplnění přesných ovladačů po průchodu. Žádný obrázek níže se nevydává za skutečný screenshot.

Každý screenshot má mít uchovaný originál, desktop/mobil variantu podle použití, alt text a samostatnou anotaci. Vizuál je zatím prázdný. Navržené targetKey jsou nové budoucí atributy, ne existující selektory.

## START-03 — Ověřit organizaci a aktivní roli

**Popis:** zjistíte, v jaké firmě a roli pracujete, a proč můžete vidět jiné menu než kolega. **Role:** všechny. **Délka:** 2 min. **Předpoklady:** aktivovaný účet, platné členství, pro přepínání více oprávněných rolí. **Vstup:** `/profile`, následně dostupná agenda. **Zdroje:** `lib/auth.ts`, `lib/rbac.ts`, `components/AppNavigation.tsx`.

| Krok | Pokyn a očekávaný výsledek | Požadovaný skutečný vizuál / budoucí target |
|---|---|---|
| 1 | Přihlaste se testovacím účtem a zkontrolujte jméno organizace v navigaci. Pokud firma nesouhlasí, nepokračujte v zadávání dat. | hlavička se syntetickou firmou; zvýraznit název; `shell.organization` |
| 2 | Otevřete profil přes uživatelský prvek „Můj profil“. Ověřte identitu. | uživatelský prvek a profil; `shell.profile` |
| 3 | Je-li účtu přiděleno více rolí, zvolte oprávněnou pracovní roli pomocí existujícího přepínače; přesné umístění a název doplnit po E2E. Nelze si přidat novou roli. | přepínač pouze s povolenými rolemi; `shell.active-role` |
| 4 | Znovu otevřete menu. Zkontrolujte dostupnost své agendy. Chybějící položka může znamenat roli nebo nezapnutý modul; kontaktujte správce. | menu před/po přepnutí; `shell.navigation` |

**Časté chyby:** zaměnění role za organizaci; očekávání, že každý ADMIN smí spravovat celou platformu. **Dokončení:** otázka „Získám změnou výběru v Akademii nové oprávnění?“ Správně: ne, rozhoduje členství/aktivní role a serverová policy. **Video:** není potřeba. **Publikační brána:** ověřit skutečný přepínač rolí a menu po opravě AUD-02/03.

## PHOTO-01 — Vyfotit existující nosič s GPS

**Popis:** uložíte fotografii ke správnému nosiči a poznáte, zda byla skutečně uložena. **Role:** WORKER/TECHNICIAN a další s povolenou upload akcí; samotný přístup VIEWER do stránky není oprávnění fotit. **Délka:** 3 min. **Předpoklady:** testovací nosič s plochou, upload právo, kamera/soubor, GPS, připojení. **Vstup:** `/mobile-photos`. **Zdroje:** `MobilePhotoFieldAppView.tsx:386–455`, `/api/mobile-photos/upload`, `lib/mobile-photo-upload.ts`.

| Krok | Pokyn a očekávaný výsledek | Vizuál / budoucí target |
|---|---|---|
| 1 | Otevřete Mobilní foto a dovolte zjištění polohy. Počkejte na „Moje GPS“; bez GPS tento postup upload nezpřístupní. | stav GPS bez skutečné domácí adresy; `mobile-photo.gps` |
| 2 | Vyhledejte testovací nosič a ověřte kód, místo a plochu. U příslušné plochy může být akce „Vyfotit výlep“ nebo „Pře-fotit“. | karta nosiče; zvýraznit kód i vybranou plochu; `mobile-photo.carrier` |
| 3 | Vyfoťte čitelný celek. Ve formuláři určete, která strana byla vyfocena a jaký je účel fotografie. | náhled a volba strany; `mobile-photo.side` |
| 4 | Zkontrolujte „GPS razítko připraveno“ a zvolte „Uložit fotku s GPS“. Vyčkejte na výsledek, neodesílejte znovu během ukládání. | tlačítko a průběh; `mobile-photo.save` |
| 5 | Přečtěte zprávu o výsledku. Při návrhu jiné plochy ověřte přiřazení. V galerii zkontrolujte fotografii. Selhání historie/Drive při úspěšném fallbacku není automaticky ztráta fotky. | úspěch a samostatně varovná varianta; `mobile-photo.result` |

**Časté chyby:** fotografování jiné strany; záměna GPS telefonu a opravy GPS nosiče; opakovaný upload při chybě vedlejšího odeslání do chatu. **Dokončení:** ve fixture najít uloženou fotografii se správným nosičem/stranou nebo zodpovědět rozlišení úspěch uploadu vs. chyba chatu. **Video:** volitelné 90 s, telefonní viewport. **Brána:** GPS permission, Drive fallback, retry a přiřazení ověřit v browseru; nepropagovat offline frontu (AUD-06).

## NAV-03 — Nechat klienta vybrat lokality bez objednání realizace

**Popis:** připravíte první fázi navigace a pochopíte, co klient potvrzuje. **Role:** ADMIN/MANAGER/SALES, klient přes platný veřejný token. **Délka:** 3 min. **Předpoklady:** testovací nabídka NAVIGATION, LOCATION_SELECTION, alespoň dva cíle a několik bodů s fotografiemi, oprávnění sdílení; žádný skutečný e-mail. **Vstup:** `/offers/[id]/navigation/edit`, klientský náhled dané nabídky. **Zdroje:** `NavigationOfferPublicView.tsx:318–343`, `app/api/proposals/[token]/selection/route.ts`, `lib/offers/workflow.ts`.

| Krok | Pokyn a očekávaný výsledek | Vizuál / budoucí target |
|---|---|---|
| 1 | Otevřete testovací navigační nabídku a ověřte, že jde o lokační výběr bez cen. Zkontrolujte všechny provozovny/cíle. | souhrn fáze a cíle; `navigation.phase` |
| 2 | Zkontrolujte u bodů GPS a terénní fotografie; vyřešte chyby připravenosti. Nevydávejte AI vizualizaci za terénní snímek. | karta bodu a kontrola; `navigation.point-readiness` |
| 3 | Otevřete její klientský náhled v odděleném anonymním fixture contextu. Přesný ovladač sdílení doplnit po ověření. | anonymní náhled bez viditelného tokenu; `navigation.client-preview` |
| 4 | Jako testovací klient vyberte alespoň jeden bod, zkontrolujte počet „Vybráno“ a potvrďte výběr k nacenění. Vzor UI říká, že zatím neschvalujete cenu ani realizaci. | výběr bodů + souhlas; `navigation.selection-confirm` |
| 5 | Zpět v interní nabídce ověřte vybrané body a záznam výběru. Dalším krokem je cenová kalkulace, ne výrobní zakázka. | interní výsledek; `navigation.selection-result` |

**Časté chyby:** záměna výběru trasy za závazné přijetí cenové nabídky; předpoklad, že všechny původní body jsou stále vybrané. **Dokončení:** otázka „Vzniká po tomto výběru objednávka výroby?“ Ne. **Video:** 120 s, střih interní/klientský pohled, jasné titulky rolí. **Brána:** AUD-04, test dvou provozoven a opakovaného potvrzení. Nepouštět klientský souhlas v produkci jako cvičení.

## NAV-05 — Předat schválenou cenovou nabídku do realizace

**Popis:** ověříte navazující zakázku a zjistíte, co udělat dál. **Role:** ADMIN/MANAGER pro interní přijetí; SALES může připravovat a sledovat jen dovolené akce. **Délka:** 3 min. **Předpoklady:** výběr lokalit hotov, PRICED_QUOTE s platnou cenou; fixture pro legitimní přijetí nabídky. **Vstup:** `/offers/[id]` → `/navigation/orders/[id]`, případně `/realization/[id]` (zde ID CRM objednávky, nezaměnit s ID nabídky). **Zdroje:** `lib/offers/domain.ts`, `lib/offers/service.ts`, `lib/navigation/navigation-service.ts`, `navigation-work-sync.ts`.

| Krok | Pokyn a očekávaný výsledek | Vizuál / budoucí target |
|---|---|---|
| 1 | Ověřte PRICED_QUOTE, cenu a přesný seznam vybraných bodů. Výběr bez cen ještě není připravenou realizací. | souhrn cenové fáze; `navigation.priced-summary` |
| 2 | Ve školícím prostředí projděte skutečné oprávněné přijetí nabídky. Průvodce ho nesmí odkliknout. Přesný název ovladače doplnit po E2E. | potvrzovací dialog s testovacími údaji; `offer.accept-review` |
| 3 | Otevřete navázanou navigační zakázku. Ověřte klienta, cíle, vybrané body a jejich fotografie. Nevytvářejte druhou zakázku jen proto, že jste obnovili stránku. | přehled vazeb; `navigation.order-links` |
| 4 | Přečtěte aktuální stav a nejbližší povolený krok: smlouva/podklady/grafika podle skutečného stavu. Fotodokumentaci/fakturaci nelze přeskočit univerzálním postupem. | stav a blokace; `navigation.next-action` |
| 5 | Zkontrolujte navazující pracovní příkaz/realizaci. Změnu již přijaté zakázky řešte řízeným změnovým postupem, nikoli očekáváním libovolné synchronizace původní nabídky. | odkazy na práci/realizaci; `navigation.work-order` |

**Časté chyby:** přijetí neoprávněnou rolí, duplicita konverze, záměna CRM ID a navigation ID, považování grafiky za hotovou montáž. **Dokončení:** na fixture potvrdit jedinou navázanou zakázku; alternativně kvíz zdrojových vazeb. **Video:** 150 s, bez skutečné obchodní akce. **Brána:** E2E převodu včetně dvou cílů/fotek, idempotence a downstream. Do té doby jen návrh lekce.

## SURVEY-02 — Zaznamenat novou plochu ve Field Survey

**Popis:** zaznamenáte kandidátní místo, aniž byste změnili galerii stávajícího nosiče. **Role:** ADMIN/MANAGER/SALES/TECHNICIAN/WORKER s Field Survey přístupem. **Délka:** 3 min. **Předpoklady:** založený testovací průzkum, kamera, GPS, povolený modul carriers. **Vstup:** `/field-survey` → „Mobilní focení“ → `/mobile-field-survey/[surveyId]`. **Zdroje:** `MobileFieldSurveyView.tsx`, `lib/field-survey/data.ts`, `app/api/field-survey/[id]/points/[pointId]/photos/route.ts`.

| Krok | Pokyn a očekávaný výsledek | Vizuál / budoucí target |
|---|---|---|
| 1 | Otevřete správný průzkum a jeho mobilní rozhraní. Jde o nové kandidátní místo, ne dokumentaci existujícího nosiče. | název průzkumu; `field-survey.context` |
| 2 | Počkejte na GPS, vyberte typ plochy a doplňte poznámku. Ověřte souřadnice a přesnost. | formulář GPS/typu; `field-survey.point-fields` |
| 3 | Zvolte „Fotit plochu“, případně „Přidat další fotku“. Vyčkejte na optimalizaci a zkontrolujte náhledy. | náhledy snímků; `field-survey.photos` |
| 4 | Zvolte „Uložit bod (… foto)“. Sledujte stavy ukládání bodu a nahrávání fotografií; nevydávejte vytvořený bod za dokončený upload všech příloh. | průběh a výsledek; `field-survey.save` |
| 5 | Zkontrolujte bod v dnešním průzkumu a v detailu akce. Případné parcelní údaje a AI analýzu ověřujte zvlášť. | uložený bod; `field-survey.completed-point` |

**Časté chyby:** použití Mobilní foto místo Field Survey; předpoklad, že průzkumný bod automaticky vytvořil reklamní nosič; pokládání AI odhadu vlastníka za potvrzené údaje. **Dokončení:** fixture bod a počet fotek odpovídají; žádný nový `Photo` v galerii nosičů. **Video:** volitelné 90 s. **Brána:** reálný mobilní upload, přerušení a opakování, export, oddělení FieldSurveyPhoto vs. Photo.

## Společné nahlášení problému

Uživatel zvolí „Nahlásit problém s návodem“, krok a důvod: jiné UI / nefungující postup / nesrozumitelné / nedostupné oprávnění / zastaralé. Krátce popíše situaci. Automaticky připojit pouze lessonRevisionId, stepId, build a bezpečný routeKey bez tokenu; uživatel vidí, co odesílá. Po uložení dostane číslo podnětu a stav. Správce tenant AcademyFeedback zpracuje, při potvrzené chybě stáhne nebo označí revizi OUTDATED. Žádné automatické posílání zákaznických dat, chatu či e-mailů z auditního prototypu.
