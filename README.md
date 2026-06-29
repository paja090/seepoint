# SeePoint MVP

MVP webové aplikace pro správu reklamních nosičů, reklamních ploch, GPS pozic, fotek a obsazenosti médií na mapě.

## Stack

- Next.js App Router + React + TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- Google Maps API (`@react-google-maps/api`)
- Lokální upload fotek do `public/uploads` s připravenou konfigurací pro pozdější object storage

## Hlavní routes

- `/` přesměruje na `/dashboard`, takže root aplikace nekončí na 404.
- `/login` obsahuje jednoduché mock přihlášení.
- `/dashboard` zobrazuje základní statistiky.
- `/map` zobrazuje mapu nosičů, detail v pravém panelu a vytvoření bodu kliknutím do mapy.
- `/carriers` a `/carriers/[id]` zobrazují seznam a detail nosičů.
- `/occupancy` zobrazuje obsazenost kampaní.
- `/settings` shrnuje provozní nastavení.

## Lokální spuštění

1. Zkopírujte environment proměnné:

   ```bash
   cp .env.example .env
   ```

2. Upravte `DATABASE_URL` v `.env` pro lokální PostgreSQL. Google Maps klíč je volitelný; bez něj aplikace použije fallback mapu.

3. Nainstalujte závislosti:

   ```bash
   npm install
   ```

4. Vygenerujte Prisma klienta:

   ```bash
   npx prisma generate
   ```

5. Spusťte vývojový server:

   ```bash
   npm run dev
   ```

6. Otevřete `http://localhost:3000`. Root route `/` přesměruje na `/dashboard`.

## Build

Produkční build spouští Prisma generate před Next buildem:

```bash
npm run build
```

Interně běží:

```bash
prisma generate && next build
```

Produkční server pak spustíte:

```bash
npm run start
```

## Deploy na Vercel

1. Nahrajte repozitář na GitHub/GitLab/Bitbucket.
2. Ve Vercelu vytvořte nový projekt z repozitáře.
3. Nastavte environment variables:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (volitelné pro fallback mapu, doporučené pro produkci)
   - `BLOB_READ_WRITE_TOKEN` (volitelné pro budoucí object storage)
4. Ověřte build command: `npm run build`.
5. Ověřte start command: `npm run start` (Vercel typicky používá vlastní runtime, ale script je připravený).
6. Po deploy otevřete root URL projektu; route `/` přesměruje na `/dashboard`.

## Poznámky k MVP

- API endpointy aktuálně používají in-memory mock store, aby šlo UI vyzkoušet bez databázových migrací.
- Prisma schéma je připravené pro PostgreSQL a následné napojení endpointů na reálnou databázi.
- Upload fotek ukládá soubory lokálně do `public/uploads`; pro produkci na serverless hostingu je vhodné přepnout na Vercel Blob, S3 nebo Google Cloud Storage.
