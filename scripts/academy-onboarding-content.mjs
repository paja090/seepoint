// Curated against the actual routes and components, 2026-10-10.
const step = (title, text, file, alt) => ({ title, blocks: [{ kind: 'text', text }, ...(file ? [{ kind: 'image', file, text: alt }] : [])] });
const uiEvidence = 'Obrazovka a obsluha v kódu zkontrolovány 10. 10. 2026. Uložení změn, odeslání pozvánky ani aktivace účtu nebyly v tomto průchodu provedeny.';
export const onboardingLessons = [
  {
    slug: 'start-01-prvni-kroky', title: 'Začínáme: od založené agentury k připravenému týmu', capability: 'organizationAdmin', status: 'PUBLISHED', verification: 'Živě ověřeno otevření onboardingu a jeho kroky. Dokončení jednotlivých nastavení není tímto potvrzeno.', duration: '2 min', route: '/onboarding',
    steps: [
      step('Zjistěte, kdo zakládá agenturu', 'Novou organizaci v SeePoint OS zakládá správce platformy SUPER_ADMIN. Běžný administrátor agentury nastavuje již založenou firmu. Pokud svou agenturu ještě nemáte, připravte její název a e-mail vlastníka pro správce SeePoint. Nezakládejte kvůli přidání kolegy další organizaci.'),
      step('Přihlaste se a zkontrolujte organizaci', 'Pokud jde o nový účet, vlastník nejprve dokončí aktivaci z pozvánky. Již aktivní účet může získat členství bez nové aktivace. Po přihlášení zkontrolujte název aktivní organizace v horní liště. Máte-li více členství, vyberte správnou firmu před úpravami.'),
      step('Otevřete úvodní přehled', 'Ve Správě otevřete Onboarding agentury. Uvidíte pět oblastí: Firemní údaje, OWNER účet, Nastavení firmy, Import ploch a Pozvání kolegů. Procento vyjadřuje stav tohoto seznamu, nikoli absolvování Akademie. Ukázková agentura už má část kroků dokončenou.', '22-onboarding-agentury.jpg', 'Skutečný onboarding školicí agentury s pěti kroky'),
      step('Postupujte od firmy k týmu', 'Nejprve doplňte Nastavení firmy, potom logo a barvy. Následně přidejte zaměstnanecké profily a podle potřeby přihlašovací přístupy. Import ploch můžete řešit později. Navazující lekce v části Začínáme vás provedou jednotlivými úkoly.'),
      step('Kontrolujte skutečné dokončení', 'Tlačítko Označit jako dokončené používejte až po kontrole nastavení. Přeskočit prozatím u importu nebo týmu neprovede import a nepozve žádného kolegu. Do onboardingu se můžete vrátit; u dokončených kroků nemusí být původní odkaz zobrazen, příslušné stránky zůstávají ve Správě.'),
    ],
  },
  {
    slug: 'start-02-zalozeni-agentury', title: 'Jak správce platformy založí novou agenturu', capability: 'platformAdmin', status: 'MEDIA_PENDING', verification: 'Postup potvrzen v CreateOrganizationForm a API /api/admin/organizations. Na živém SUPER_ADMIN účtu ani odesláním nebyl ověřen. Screenshot čeká na pořízení.', duration: '3 min', route: '/onboarding',
    steps: [
      step('Otevřete založení organizace', 'Tato lekce je pouze pro SUPER_ADMIN platformy. Na stránce Onboarding agentury je sekce Založit novou organizaci. Vlastník běžné agentury tento formulář nevidí.'),
      step('Vyplňte identitu a vlastníka', 'Vyplňte Název, Slug a E-mail OWNERA. Slug je jedinečný identifikátor z malých písmen bez diakritiky, číslic a pomlček, například ukazkova-agentura. E-mail OWNERA patří člověku, který má agenturu spravovat. Firemní e-mail je samostatný kontaktní údaj. Doplňte IČO a DIČ, pokud je máte.'),
      step('Připravte firemní identitu', 'V části Firemní identita (White-label) můžete zadat URL loga společnosti a Hlavní firemní barvu (HEX). Logo se zadává odkazem na obrázek; formulář zde nenabízí nahrání souboru. Údaje lze později upravit v Nastavení firmy.'),
      step('Založte agenturu a přečtěte výsledek', 'Po kontrole příjemce klikněte na Založit organizaci a OWNER účet. Tím skutečně vzniká organizace a členství. Nový nebo dosud neaktivovaný účet potřebuje aktivaci. Existující aktivní vlastník získá členství přímo a aktivační e-mail se mu neposílá. Pokud hlášení říká, že organizace vznikla, ale e-mail neodešel, neopakujte slepě založení.'),
      step('Předejte pokračování vlastníkovi', 'Odkaz Otevřít detail organizace se zobrazí po úspěchu. Vlastník pokračuje aktivací, přihlášením a lekcí firemních údajů. Slug již existuje znamená kolizi identifikátoru, nikoli důvod zakládat duplicitní účet. Tento postup zatím čeká na úplný živý test a screenshoty.'),
    ],
  },
  {
    slug: 'start-03-firemni-udaje', title: 'Jak nastavit firemní a fakturační údaje', capability: 'organizationAdmin', status: 'PUBLISHED', verification: uiEvidence, duration: '3 min', route: '/settings/company',
    steps: [
      step('Otevřete nastavení správné firmy', 'Jako vlastník nebo administrátor organizace zkontrolujte aktivní firmu a otevřete Správa → Nastavení firmy. Stránka má nadpis Nastavení firmy & Měření Služeb. Pod přehledem spotřeby najdete Firemní a fakturační údaje.'),
      step('Doplňte název, adresu a kontakt', 'Vyplňte Název firmy, IČO, DIČ, Ulice, Město, PSČ a Země. Následují Telefon, Firemní e-mail a Web. Použijte skutečné údaje své firmy. Web musí být úplná HTTPS adresa. Školicí snímek má většinu údajů prázdnou.', '21-firemni-udaje.jpg', 'Výřez skutečného firemního formuláře bez soukromých údajů'),
      step('Zkontrolujte banku a nové faktury', 'Podle potřeby doplňte Bankovní účet, IBAN, SWIFT a Výchozí měna, například CZK. V části Výchozí nastavení vystavených faktur nastavte Splatnost (dní), Výchozí DPH (%) a Prefix číselné řady. Splatnost musí být 1–365 dní. Tato nastavení platí pro nové faktury, již vystavené doklady se nemění.'),
      step('Přidejte podpis a uložte', 'Do E-mailový podpis zadejte podpis firmy. Klikněte na Uložit firemní údaje a očekávejte hlášení Firemní údaje byly uloženy. Při chybě opravte uvedené pole. Po novém načtení stránky zkontrolujte hodnoty. Uložení a následné načtení nebylo při tvorbě této lekce živě testováno.'),
    ],
  },
  {
    slug: 'start-04-logo-a-barvy', title: 'Jak nastavit logo a firemní barvy', capability: 'organizationAdmin', status: 'PUBLISHED', verification: uiEvidence, duration: '2 min', route: '/settings/company',
    steps: [
      step('Připravte odkaz na logo', 'Připravte HTTPS odkaz přímo na obrázek firemního loga. Nejde o cestu k souboru ve vašem počítači ani odkaz na stránku vyžadující přihlášení. V tomto formuláři je pole URL loga, nikoli tlačítko pro upload. Dostupnost obrázku si ověřte otevřením odkazu.'),
      step('Vyplňte logo v Nastavení firmy', 'Otevřete Správa → Nastavení firmy. V části Firemní a fakturační údaje vložte odkaz do URL loga. Pokud nechcete měnit ostatní údaje, ponechte jejich stávající hodnoty.', '21-firemni-udaje.jpg', 'URL loga a pole firemních barev ve skutečném formuláři'),
      step('Nastavte barvy', 'Do Primární barva a případně Sekundární barva zadejte barvu ve formátu #RRGGBB, například #0ea5e9. Slovní název barvy ani zkrácený kód #fff validační pravidla nepřijmou.'),
      step('Uložte a ověřte výsledek', 'Klikněte na Uložit firemní údaje. Po úspěšném hlášení znovu načtěte stránku a zkontrolujte URL i kódy barev. Potom prohlédněte místa, kde se logo používá. Rozsah promítnutí do všech PDF, portálů a tlačítek nebyl v této lekci živě ověřen; samotné uložení nezaručuje změnu každé části aplikace.'),
    ],
  },
  {
    slug: 'start-05-zamestnanec', title: 'Jak založit zaměstnance a rozlišit jeho přístup', capability: 'employees', status: 'PUBLISHED', verification: 'Živě ověřeno 10. 10. 2026: vytvoření školicího zaměstnance bez přístupu, otevření jeho karty a samostatná sekce přihlašovacího účtu.', duration: '3 min', route: '/employees',
    steps: [
      step('Otevřete Nový zaměstnanec', 'Jako administrátor nebo manažer s dostupným modulem zaměstnanců otevřete Správa → Zaměstnanci & Tým. Rozbalte Nový zaměstnanec, pokud je zavřený. Nejdřív ověřte, že kolega již není v evidenci.'),
      step('Vyplňte základní profil', 'Zadejte Jméno a Příjmení. Doplňte E-mail a případně Telefon. Do Pozice lze napsat více pozic oddělených čárkou. Role určuje pracovní oprávnění; manažer nemůže založit administrátora. Doplňte Typ spolupráce a podle potřeby Datum nástupu. Na snímku je pouze školicí profil.', '24-novy-zamestnanec.jpg', 'Vyplněný školicí zaměstnanec před uložením'),
      step('Rozhodněte o přihlašovacím účtu', 'Pro samotnou evidenci ponechte Povolit přístup do aplikace nezaškrtnuté. Takto proběhl ověřený průchod. Samotný e-mail účet nezaloží. Zaškrtnutí nabízí jinou cestu s dočasným heslem; tato lekce její aktivaci netestuje. Pro pozdější přístup použijte sekci na detailu zaměstnance.'),
      step('Uložte a zkontrolujte kartu', 'Klikněte na Založit zaměstnance. Po úspěšném uložení se otevře detail. Zkontrolujte jméno, e-mail, roli a pozici. U ukázky se otevřela karta AKADEMIE Ukázkový pracovník. Stav Aktivní u zaměstnaneckého profilu sám o sobě neznamená aktivní přihlašovací účet.', '25-karta-zamestnance.jpg', 'Uložená karta školicího zaměstnance'),
      step('Najděte samostatné přístupové nastavení', 'Níže je Přístup do Aplikace & Přiřazené Funkce. Text Profil zaměstnance není přímo propojený s přihlašovacím účtem potvrzuje oddělení evidence a přístupu. Tlačítko Povolit přístup & Odeslat pozvánku e-mailem již mění přístup a může odeslat e-mail. Před použitím zkontrolujte adresu i roli; při našem průchodu stisknuto nebylo.', '26-pristup-zamestnance.jpg', 'Samostatná správa přístupu školicího zaměstnance'),
    ],
  },
  {
    slug: 'start-06-pozvani-kolegy', title: 'Jak pozvat kolegu do agentury a ověřit aktivaci', capability: 'organizationAdmin', status: 'MEDIA_PENDING', verification: uiEvidence, duration: '3 min', route: '/settings/members',
    steps: [
      step('Vyberte správný způsob přidání', 'Potřebujete-li pouze členství v organizaci, otevřete Správa → Uživatelé organizace. Pokud chcete propojit konkrétní zaměstnaneckou kartu, začněte její sekcí Přístup do Aplikace & Přiřazené Funkce. Pozvání člena přes Uživatelé organizace samo nevytváří zaměstnanecký profil.'),
      step('Zadejte e-mail a vyberte roli', 'V horním formuláři vyplňte E-mail a Role. Výchozí hodnota je Náhled. Nabídka obsahuje Administrátor, Manažer, Obchodník, Technik, Pracovník, Účetní a Náhled. Vyberte roli podle práce kolegy; automaticky každému nepřidělujte administrátora.'),
      step('Odešlete pozvánku a čtěte hlášení', 'Po kontrole adresy a role klikněte na Pozvat. Tato akce vytváří členství a pro účet vyžadující aktivaci odesílá pozvánku. Hlášení o vytvoření není důkaz doručení e-mailu. Pokud aplikace oznámí problém s odesláním, nepovažujte přístup za vyřešený. Odeslání jsme při tvorbě návodu neprováděli.'),
      step('Nechte kolegu dokončit aktivaci', 'Nový kolega otevře aktivační odkaz a sám nastaví své heslo. Aktivační pozvánka má podle aktuální implementace platnost 48 hodin. Existující aktivní účet může dostat členství přímo bez nového nastavování hesla. Jeden účet může být členem více agentur.'),
      step('Zkontrolujte členství a přihlášení', 'Na stejné stránce jsou Aktivní pozvánky a Členové organizace. Obnovte stránku a zkontrolujte správný e-mail, roli a stav. Nový kolega má po přihlášení zkontrolovat aktivní organizaci a své dostupné moduly. Chybějící modul může souviset s rolí nebo nastavením organizace, ne nutně s neúspěšnou pozvánkou.'),
    ],
  },
].map(lesson => ({ ...lesson, category: 'Začínáme · Firma a tým', verifiedAt: '2026-10-10' }));
