# Akademie – první průchod skutečnou aplikací

9. 10. 2026. Uživatel výslovně povolil použití dat a vytváření školicích záznamů v QX ProMotion nebo SeePoint. Dostupná přihlášená relace patřila QX promotion; nebyly měněny přístupy ani organizace.

Dokončeno: [návod na vytvoření navigačního konceptu](01-navigacni-koncept.md), šest skutečných screenshotů a ověření přetrvání vytvořeného konceptu po obnovení stránky.

Vytvořen jediný nový koncept `cmv111hh20001l806tfui6j80`, název „AKADEMIE – navigace krok za krokem – 2026-10-09 – NEODESÍLAT“. Existující testovací klient, jedna ukázková provozovna, jeden bod. Stav Draft, fáze 1. Nebylo použito odesílání ani schvalování a nebylo provedeno nasazení či migrace Akademie. Aplikace v detailu sama zpřístupňuje aktivní klientský odkaz; jeho token není součástí těchto souborů.

Stav lekce VERIFIED se týká výhradně popsaného desktopového průchodu ADMIN. Neznamená ověření celé navigace, mobilního rozhraní, ostatních rolí či navazující realizace. Návod zatím není zveřejněn v aplikaci.

## UX poznatky z tohoto průchodu

1. **P2 – výchozí poloha může působit jako hotový návrh.** V nové nabídce ponechat výchozí cíl a použít „+ Přidat navigační bod“. Přibude bod poblíž cíle, v tomto případě v památkové zóně. Očekávané zjednodušení: jasně označit výchozí polohu a vyžádat její potvrzení před odesláním. Zdroj: NavigationMapStep.tsx. Jde o UX riziko potvrzené tímto průchodem, nikoli právní posouzení lokality.
2. **P3 – dvě shodná ukládací tlačítka.** Ve 4. kroku jsou současně dvě tlačítka „Uložit nabídku navigace“. Jedno uložení fungovalo. Doporučení: jediná primární ukládací akce. Zdroj: krok kontroly a společná lišta navigačního formuláře; přesné sestavení rodiče ještě prověřit.
3. **P2 – klientské potvrzení uvnitř interního detailu.** Po uložení Draftu obsahuje interní detail formulář „Vaše jméno“, „Váš e-mail“ a „Potvrdit body k nacenění“. Uživatel může zaměnit prohlížení za další povinný interní krok. Doporučení: klientský náhled jasně oddělit a označit. Potvrzení nebylo stisknuto, jeho chování není tímto nálezem ověřeno.

## Druhý průchod – více provozoven

Dokončena [lekce úpravy a přidání druhé provozovny](02-vice-provozoven.md), stav VERIFIED pro desktopový ADMIN průchod. Přidány snímky 07–09. Stejný školicí koncept nyní obsahuje dvě provozovny a dva body; každá provozovna má jeden přiřazený bod. Potvrzení uložení i zachování vazeb po reloadu ověřeno v UI. Původní snímky 01–06 zachycují předchozí verzi konceptu a nebyly přepsány.

Další UX poznatek: po přidání druhé provozovny a přechodu na mapu nový bod směřoval k první provozovně. Explicitní změna pole Cílová provozovna fungovala a uložila se. V návodu je tento krok zvýrazněn; doporučením je zřetelně ukazovat cíl ještě před přidáním bodu. Nejde o doloženou ztrátu dat.

## Třetí průchod – náhled a kontrola před odesláním

Dokončeny dvě úzce vymezené lekce: [kontrola klientského náhledu a filtru poboček](03-kontrola-klientskeho-nahledu.md) a [zjištění chybějících podkladů před odesláním](04-proc-nelze-odeslat-nabidku.md). Přidány snímky 10–12. Prokázán přechod 2 karty → 1 karta druhé provozovny → 2 karty a zakázané odesílací tlačítko při třech chybějících podkladech. Žádné e-maily ani potvrzení nebyly odeslány.

### Další nálezy

- **P2 – nepravdivé potvrzení vyplněného kontaktu.** `/offers/[id]/approval`, `lib/offers/workflow.ts:33–37`: u lokační fáze 1 bez e-mailu přejít z náhledu na kontrolu. Skutečnost: kontrola tvrdí „Klient a kontaktní e-mail jsou vyplněny“. Očekávání: výjimku bez e-mailu popsat pravdivě. Příčina v pracovním stromu: contactReady zahrnuje isNavigationLocationSelection, ale text úspěchu rozlišuje pouze isNoPrice. Návrh: zvláštní zpráva pro lokační koncept a nezávislá kontrola skutečného příjemce při odesílání. Oprava ani skutečné odeslání zatím neprovedeny.
- **P2 – přečíslování bodů při filtraci pobočky.** V klientském náhledu zapnout filtr druhé provozovny. Její původně druhý bod dostane v kartě i na mapě číslo #1, zatímco celkový výběr zůstává 2/2. Očekávání: stabilní číslo bodu napříč filtrem pro jednoznačnou domluvu s klientem. Návrh: odvozovat zobrazované číslo z celého seznamu, nikoli filtrovaného pořadí, a popsat celkový rozsah počítadla výběru. Ověřeno v interním náhledu, veřejný nepřihlášený průchod zatím neověřen.

Následující samostatné lekce: skutečný klientský výběr; nacenění; předání do realizace; mobilní fotodokumentace. Jejich stav zůstává PLANNED / MEDIA_PENDING podle předchozího katalogu, dokud není ověřen celý konkrétní úkol.
