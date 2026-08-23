# SeePoint – audit integrací a úložiště

Datum: 2026-08-23

## Přehled

| Služba | Dnes | Cílový SaaS stav | Priorita |
|---|---|---|---|
| PostgreSQL | Jedna Neon DB přes Prisma | Společná DB s povinnou tenant isolation | Hotovo |
| Vercel | Jeden projekt a společné serverové proměnné | Centrální platformní runtime | Zachovat |
| Google Maps | Centrální browser/server klíč | Centrální SeePoint služba + usage metering | Střední |
| Gemini/OpenAI | Centrální klíče, více přímých volání | Centrální AI gateway + tenantový `AIUsage` | Vysoká |
| Fotografie | Google Drive, PostgreSQL Bytes, data URI a externí URL | Provider-neutral SeePoint Storage s tenantovými klíči | Kritická |
| Dokumenty/PDF | Generování za běhu, PDF upload někdy v DB | Objektové storage, privátní download endpoint | Vysoká |
| Google Drive | Jeden OAuth/service-account účet a společný root | Volitelný tenant OAuth konektor; historické soubory read-only kompatibilní | Vysoká |
| E-mail | Resend/webhook, fallback přes společný Google OAuth | Centrální transakční e-mail + volitelný Gmail OAuth firmy | Vysoká |
| Excel import | Tenantově izolované preview/import endpointy | Samoobslužný import s uloženým souborem, mapováním a reportem | Střední |
| Veřejné nabídky | Kryptografický token a tenant branding | Zachovat, doplnit usage/audit | Hotovo |
| Login a role | Globální User + OrganizationMember | Aktivní organizace, pozvánky a oddělený SUPER_ADMIN | Hotovo |

## Zjištění

1. `Photo` je dnes společný metadata model, ale payload může být na čtyřech místech. Čtecí endpointy tuto logiku opakovaly.
2. Google Drive používá platformní OAuth refresh token nebo service account z `.env`; nejde ještě o tenantové OAuth připojení.
3. Upload z mobilu má bezpečný DB fallback, ostatní uploady se chovají rozdílně. Velké soubory v PostgreSQL zvyšují DB egress a velikost záloh.
4. Thumbnail endpoint historicky stahuje originál z Drive; fyzická optimalizovaná varianta zatím nevzniká.
5. AI volání jsou tenantově izolovaná daty, ale nemají jednotné měření tokenů, obrázků ani odhadované ceny.
6. Google Maps a AI patří mezi centrálně provozované integrace. Drive/Gmail/účetnictví mají být později připojovány organizací přes OAuth.
7. `.env` zůstává platformní konfigurace. Zákaznické secrets nesmí být přidávány jako nové environment variables pro každý tenant.

Preview inventura po metadata migraci: 707 fotografií, z toho 703 Google Drive a 4 databázové payloady (2 `Bytes`, 2 historické data URI). Po normalizaci má každý záznam s interním payloadem canonical storage key; žádný soubor nebyl při inventuře načten ani změněn.

## Provedený bezpečný mezikrok

- `Photo` dostává provider-neutral `storageKey`, klíče budoucích variant a checksum.
- Klíč má vždy tvar `organizations/{organizationId}/{resource}/{resourceId}/{variant}/{fileName}`.
- Historické `driveFileId`, DB payloady a URL zůstávají beze změny a čitelné.
- Nová storage služba umí současný Drive a tenantově izolovaný DB fallback. Budoucí `SEEPOINT_STORAGE` selže zavřeně, dokud nebude připojen konkrétní Blob/GCS adaptér.
- Migrace pouze doplní metadata; žádný soubor nemaže ani nepřesouvá.

## Další implementační krok

1. Vybrat Vercel Blob nebo Google Cloud Storage a vytvořit privátní produkční bucket/store.
2. Doplnit adaptér `SEEPOINT_STORAGE` a podepsané/ověřené čtení přes aplikační endpoint.
3. Při uploadu asynchronně vytvořit `web` a `thumbnail` variantu.
4. Přepnout nové uploady, sledovat chybovost a egress; historický Drive ponechat jako fallback.
5. Teprve po auditu počtů a checksumů spustit postupnou historickou migraci.
