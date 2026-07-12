# Integrace Google Drive pro Fotografie Nosičů

Tento dokument popisuje architekturu, bezpečnostní pravidla a postup konfigurace propojení systému SeePoint s firemním úložištěm Google Drive.

## 1. Architektura Napojení

Aplikace SeePoint přistupuje k určené složce na Google Disku přes **Google Service Account** nebo konfigurovaný systémový účet (pomocí OAuth Refresh Tokenu). 

### Vlastnosti:
- Uživatelé se nemusí k Disku přihlašovat jednotlivě.
- Aplikace přistupuje na Disk pouze na serveru přes bezpečné API.
- Soubory se nestahují ani neukládají trvale do databáze, na Vercel Blob ani na disk serveru. Přenáší se pouze metadata a stabilní `driveFileId`.
- Zobrazení fotografií v prohlížeči probíhá streamováním binárního obsahu přes server (`/api/photos/[id]/content`).

---

## 2. Bezpečnostní Pravidla

1. **Žádné klientské tokeny:** Google access token ani privátní klíč service accountu se nikdy nesmí dostat do prohlížeče.
2. **Omezení přístupu:** API endpointy `/api/photos/[id]/content` a `/api/photos/[id]/thumbnail` provádějí kompletní kontrolu session a oprávnění uživatele. Nepřihlášený nebo neoprávněný uživatel soubor nestáhne ani při znalosti interního ID.
3. **Předcházení injektážím:** Uživatel nemůže podstrčit libovolné `driveFileId` z cizího disku. Při propojování se volá funkce `verifyFileInFolder`, která ověřuje, zda soubor leží přímo v povolené firemní složce (`GOOGLE_DRIVE_FOLDER_ID`).

---

## 3. Nastavení v Google Cloud a Google Drive

### Krok 1: Vytvoření projektu v Google Cloud Console
1. Přejděte do [Google Cloud Console](https://console.cloud.google.com/).
2. Vytvořte nový projekt nebo zvolte existující.
3. Přejděte do **API & Services** -> **Enabled APIs & Services** -> Klikněte na **+ ENABLE APIS AND SERVICES**.
4. Vyhledejte a aktivujte **Google Drive API**.

### Krok 2: Vytvoření Service Accountu (nebo OAuth přihlášení)
*Poznámka: Projekt SeePoint využívá stávající OAuth Refresh Token schéma konfigurace.*
Pro získání přihlašovacích údajů:
1. V **Credentials** vytvořte **OAuth client ID** (typ Web application).
2. Získejte `Client ID` a `Client Secret`.
3. Získejte `Refresh Token` s rozsahem (scope) `https://www.googleapis.com/auth/drive.file` nebo `https://www.googleapis.com/auth/drive`.

### Krok 3: Získání ID složky na Google Disku
1. Otevřete Google Drive ve svém prohlížeči a přejděte do složky, kterou chcete vyhradit pro fotky SeePointu.
2. Zkopírujte ID složky z adresního řádku. URL vypadá takto:
   `https://drive.google.com/drive/folders/1A2B3C4D5E6F7G8H9I0J`
   V tomto případě je `GOOGLE_DRIVE_FOLDER_ID` hodnota `1A2B3C4D5E6F7G8H9I0J`.
3. Pokud složka leží na **Shared Drive** (Sdíleném disku), API volání automaticky využívají parametry `supportsAllDrives=true` a `includeItemsFromAllDrives=true`.

---

## 4. Konfigurace Environmentálních Proměnných

Do souboru `.env` (nebo nastavení prostředí na Vercelu) doplňte následující hodnoty:

```env
# Google Drive API configuration
GOOGLE_DRIVE_CLIENT_ID="vase-client-id"
GOOGLE_DRIVE_CLIENT_SECRET="vas-client-secret"
GOOGLE_DRIVE_REFRESH_TOKEN="vas-refresh-token"
GOOGLE_DRIVE_FOLDER_ID="id-vyhradene-slozky"

# Explicitní povolení/zakázání Mock režimu pro lokální vývoj
GOOGLE_DRIVE_MOCK_ENABLED="false"
```

### Víceřádkové klíče (pokud by se v budoucnu přecházelo na Service Account)
Pokud ukládáte na Vercel privátní klíč obsahující nové řádky `\n`, uložte jej jako jeden řetězec a v kódu jej načtěte pomocí:
`privateKey.replace(/\\n/g, '\n')`.

---

## 5. Režim Lokálního Vývoje (Development Mock)

Pokud vyvíjíte lokálně a nechcete nebo nemůžete nastavit reálné Google Drive údaje, SeePoint obsahuje plnohodnotný **in-memory mock**.

### Pravidla aktivace mocku:
- Mock se **nespouští automaticky** při chybějících údajích (tím se zabrání chybám při špatné konfiguraci produkce).
- Mock je povolen **výhradně** pokud:
  - `process.env.NODE_ENV !== 'production'`
  - **A ZÁROVEŇ** `process.env.GOOGLE_DRIVE_MOCK_ENABLED === 'true'`.
- V produkci (`production`) se mock nespustí za žádných okolností. Pokud chybí credentials, vyhodí aplikace bezpečnou konfigurační chybu `503`.

### Chování mocku:
- Simuluje výpis souborů (vrací 4 výchozí makety fotografií s reálnými náhledy z Unsplashe).
- Umožňuje simulované "nahrávání" a "propojování" (soubory se ukládají v paměti procesu a ihned se propisují do galerie).
- Zajišťuje plný průchod uživatelského scénáře v prohlížeči.
