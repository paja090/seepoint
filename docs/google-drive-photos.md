# Integrace Google Drive pro Fotografie Nosičů

Tento dokument popisuje architekturu, bezpečnostní pravidla a postup konfigurace propojení systému SeePoint s firemním úložištěm Google Drive.

## 1. Architektura Napojení (Service Account)

Pro zajištění stability, bezpečnosti a automatického serverového přístupu k firemním souborům používá SeePoint **Google Service Account (Servisní účet)**. 

### Proč Service Account místo osobního OAuth přihlášení?
1. **Přístup k existujícím souborům:** Výchozí Google OAuth se scope `drive.file` neumožňuje serverové aplikaci vidět ani vypsat soubory, které byly do složky nahrány mimo tuto aplikaci (např. přes webové rozhraní Google Drive nebo mobilní aplikaci). Zobrazilo by se pouze prázdné pole. Širší scope `drive.readonly` by zase aplikaci umožnil vidět celý osobní disk uživatele, což je vážné bezpečnostní riziko.
2. **Nezávislost na uživateli:** Přístup není navázán na konkrétního zaměstnance. Změna hesla, odchod pracovníka nebo revokace tokenu v jeho profilu nijak nenaruší chod integrace.
3. **Princip nejnižších oprávnění:** Servisní účet má přístup **pouze a výhradně** do složek a sdílených disků (Shared Drives), které mu správce explicitně nasdílí v rozhraní Google Drive.

### Vlastnosti:
- Uživatelé se nemusí k Disku přihlašovat jednotlivě.
- Aplikace přistupuje na Disk pouze na serveru přes bezpečné API pod identitou Service Accountu.
- Soubory se nestahují ani neukládají trvale do databáze, na Vercel Blob ani na disk serveru. Přenáší se pouze metadata a stabilní `driveFileId`.
- Zobrazení fotografií v prohlížeči probíhá streamováním binárního obsahu přes server (`/api/photos/[id]/content`).

---

## 2. Bezpečnostní Pravidla

1. **Žádné klientské tokeny:** Google access token ani privátní klíč service accountu se nikdy nesmí dostat do prohlížeče.
2. **Omezení přístupu:** API endpointy `/api/photos/[id]/content` a `/api/photos/[id]/thumbnail` provádějí kompletní kontrolu session a oprávnění uživatele. Nepřihlášený nebo neoprávněný uživatel soubor nestáhne ani při znalosti interního ID.
3. **Předcházení injektážím:** Uživatel nemůže podstrčit libovolné `driveFileId` z cizího disku. Při propojování se volá funkce `verifyFileInFolder`, která ověřuje, zda soubor leží přímo v povolené firemní složce (`GOOGLE_DRIVE_FOLDER_ID`).

---

## 3. Nastavení v Google Cloud a Google Drive

### Krok 1: Vytvoření Service Accountu v Google Cloud Console
1. Přejděte do [Google Cloud Console](https://console.cloud.google.com/).
2. Vytvořte nový projekt nebo zvolte existující.
3. Aktivujte **Google Drive API** (v *APIs & Services* -> *Enabled APIs & Services*).
4. V levém menu zvolte **IAM & Admin** -> **Service Accounts**.
5. Klikněte na **+ CREATE SERVICE ACCOUNT**. Vyplňte název (např. `seepoint-drive-sa`) a dokončete vytvoření.
6. Rozklikněte vytvořený účet, přejděte do záložky **Keys** -> klikněte na **Add Key** -> **Create new key** (formát **JSON**).
7. Stáhne se JSON soubor. Z něj budeme potřebovat:
   - `client_email` (e-mailová adresa servisního účtu)
   - `private_key` (privátní klíč uvozený `-----BEGIN PRIVATE KEY-----`)

### Krok 2: Nasdílení složky na Google Disku servisnímu účtu
1. Otevřete Google Drive ve svém prohlížeči a přejděte do složky (nebo Shared Drive), kterou chcete vyhradit pro fotky SeePointu.
2. Klikněte pravým tlačítkem na složku -> **Share** (Sdílet).
3. Do pole pro e-mail zadejte zkopírovanou adresu `client_email` servisního účtu (např. `seepoint-drive-sa@cesty.iam.gserviceaccount.com`).
4. Nastavte roli na **Editor** (aby mohl SeePoint fotky nahrávat) nebo **Viewer** (pokud by měl pouze číst).
5. Zkopírujte ID složky z adresního řádku prohlížeče (část za `/folders/`).

*Poznámka pro Google Workspace:* Ujistěte se, že politika vaší organizace dovoluje sdílet soubory s externími identitami mimo doménu (servisní účet má doménu `@...iam.gserviceaccount.com`). V případě potřeby musí administrátor Workspace povolit externí sdílení pro tuto konkrétní složku.

---

## 4. Konfigurace Environmentálních Proměnných

Do souboru `.env` (nebo nastavení prostředí na Vercelu) doplňte následující hodnoty z JSON klíče:

```env
# Google Drive API configuration (Service Account)
GOOGLE_SERVICE_ACCOUNT_EMAIL="seepoint-drive-sa@cesty.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC..."
GOOGLE_DRIVE_FOLDER_ID="1A2B3C4D5E6F7G8H9I0J"

# Explicitní povolení/zakázání Mock režimu pro lokální vývoj
GOOGLE_DRIVE_MOCK_ENABLED="false"
```

### DŮLEŽITÉ: Zápis privátního klíče na Vercelu
Při vkládání `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` do nastavení prostředí na Vercelu (Vercel Environment Variables) vložte klíč **včetně nových řádků** nebo nahraďte konce řádků za `\n`. Naše implementace v kódu automaticky provádí převod `privateKey.replace(/\\n/g, '\n')`, což zaručuje bezpečné načtení klíče bez ohledu na formátování vstupu.

---

## 5. Režim Lokálního Vývoje (Development Mock)

Pokud vyvíjíte lokálně a nechcete nebo nemůžete nastavit reálné Google Drive údaje, SeePoint obsahuje plnohodnotný **in-memory mock**.

### Pravidla aktivace mocku:
- Mock se **nespouští automaticky** při chybějících credentials (tím se zabrání chybám při špatné konfiguraci produkce).
- Mock je povolen **výhradně** pokud:
  - `process.env.NODE_ENV !== 'production'`
  - **A ZÁROVEŇ** `process.env.GOOGLE_DRIVE_MOCK_ENABLED === 'true'`.
- V produkci (`production`) se mock nespustí za žádných okolností. Pokud chybí credentials, vyhodí aplikace bezpečnou konfigurační chybu `503`.

### Chování mocku:
- Simuluje výpis souborů (vrací 4 výchozí makety fotografií s reálnými náhledy z Unsplashe).
- Umožňuje simulované "nahrávání" a "propojování" (soubory se ukládají v paměti procesu a ihned se propisují do galerie).
- Zajišťuje plný průchod uživatelského scénáře v prohlížeči.
