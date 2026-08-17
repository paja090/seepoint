# SeePoint Application

Produkční webový a mobilní systém pro kompletní správu reklamních nosičů, reklamních ploch, CRM, obchodních nabídek, navigačního značení, terénních pracovních zakázek, fotodokumentace, vyúčtování pracovníků a klientské fakturace.

---

## 🚀 Technologie

- **Frontend & Server Components:** Next.js (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS, PostCSS, Lucide React Icons
- **Database & ORM:** PostgreSQL, Prisma ORM
- **Maps & Geolocation:** Google Maps API & Leaflet Integration
- **PDF Generation:** pdfmake
- **Excel Import/Export:** ExcelJS
- **Document & Photo Storage:** Google Drive API & Local fallback

---

## 🏢 Přehled Modulů

### 1. Dashboard (`/dashboard`)
Manažerský přehled založený pouze nad reálnými daty z databáze PostgreSQL:
- **Obchod:** Nabídky podle stavu (`DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`), CRM zakázky, hodnota pipeline.
- **Média:** Aktivní reklamní nosiče, obsazenost ploch (`AVAILABLE`, `RESERVED`, `OCCUPIED`, `OUT_OF_SERVICE`).
- **Navigace:** Aktivní navigační zakázky, stav schvalování grafiky, tisk, instalace, fotodokumentace, fakturace.
- **Práce:** Plánované a rozpracované `WorkOrder` a `WorkTask`, úkoly po termínu, neschválené výkazy.
- **Finance:** Čekající vyúčtování `Settlement`, klientské faktury `ClientInvoice` po splatnosti.

### 2. CRM – Klienti (`/crm/clients`)
Klientský modul s centrální entitou `Client`. Detail klienta funguje jako centrum všech vztahů:
- Záložky: Přehled, Kontakty, Pobočky, Nabídky, Zakázky, Realizace, Smlouvy, Fakturace, Komunikace, Úkoly, Dokumenty, Historie.

### 3. CRM – Nabídky (`/offers`)
Správa obchodních nabídek (`STANDARD_MEDIA`, `NAVIGATION`, `CITY_GALLERY`):
- Workflow: `DRAFT` → `SENT` → `ACCEPTED` / `REJECTED` / `EXPIRED`.
- Idempotentní konverze akceptované nabídky na `CrmOrder`.
- Veřejný klientský náhled s akceptací.

### 4. CRM – Zakázky (`/crm/orders`)
Centrální potvrzená zakázka klienta vzniklá z nabídky. Propojuje realizace, pracovní zakázky, smlouvy a klientské faktury.

### 5. CRM – Úkoly (`/crm/tasks`)
Obchodní a administrativní úkoly vázané na klienty, smlouvy nebo faktury (`CrmTask`).

### 6. Média – Nosiče & Plochy (`/carriers`, `/surfaces`)
- `AdvertisingCarrier`: Fyzický reklamní nosič s GPS pozicí, typem konstrukce a adresou.
- `AdvertisingSurface`: Samostatná obchodovatelná reklamní pozice.
- `Occupancy`: Zdroj pravdy obchodní obsazenosti a kampaní.

### 7. Média – Mapa (`/map`)
Interaktivní mapa nosičů s filtry podle médií, klienta, obsazenosti, města a technického stavu.

### 8. Navigace (`/navigation`)
Specializovaný modul pro navigační značení:
- Návrh tras a vizualizace šipek.
- 13krokové workflow zakázky od poptávky po dokončení.
- Kontrola kvality (QC) a generování kvartálních fotodokumentací pro klienty.

### 9. Práce & Vyúčtování (`/work-orders`, `/settlement`)
- Fyzické pracovní zakázky (`WorkOrder`) a úkoly montérů (`WorkTask`).
- Výkazy práce (`WorkEntry`) a výdaje (`WorkExpense`).
- Schvalovací workflow vyúčtování pracovníků (`Settlement`: `DRAFT` → `SUBMITTED` → `APPROVED` → `LOCKED` → `PAID`).
- Dodavatelské faktury pracovníků (`Invoice`).

### 10. Klientská fakturace (`/invoices`)
Fakturace SeePointu ke klientům (`ClientInvoice`) z CRM zakázek a navigačních období.

### 11. Mobilní fotodokumentace (`/mobile-photos`)
Terénní rozhraní optimalizované pro mobilní telefony montérů: foto před/po instalaci s GPS a AI rozpoznáním nosičů.

---

## 📖 Architektura

Podrobný popis architektury, zdrojů pravdy a doménových vztahů naleznete v [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 🛠️ Vývoj a Spuštění

### 1. Klonování a instalace
```bash
git clone https://github.com/paja090/seepoint.git
cd seepoint
npm install
```

### 2. Konfigurace databáze
Vytvořte `.env` soubor s připojením k PostgreSQL:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/seepoint?schema=public"
```

### 3. Generování Prisma klienta
```bash
npx prisma generate
```

### 4. Spuštění vývojového serveru
```bash
npm run dev
```

### 5. Kontrola typu a spuštění testů
```bash
npm run typecheck
npx tsx --test tests/*.test.ts
```

### 6. Produkční build
```bash
npm run build
npm run start
```
