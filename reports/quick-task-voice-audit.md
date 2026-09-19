# Audit hlasového zadávání AI Rychlého Úkolníčku

Datum: 19. 9. 2026

## Původní příčina

`AiQuickTaskModal` používal výhradně Web Speech API. Kontrola přítomnosti konstruktoru nezaručovala doručení výsledku. Každé kliknutí vytvářelo novou lokální instanci recognition. Druhé kliknutí měnilo pouze React stav, nikdy nevolalo stop/abort na běžící instanci. Nebyl ref, cleanup při zavření ani unmountu. Handlery byly registrovány až po startu. `onerror` a `onend` pouze zhasly indikátor, takže odmítnutí oprávnění i ukončení bez výsledku vypadaly stejně. Synchronní chyba startu nebyla zachycena.

`parse-quick-tasks` neměl timeout a přímo předával modelové employee ID do Prisma. Tenant extension již omezovala Employee a QuickInternalTask; problém tedy nebyl chybějící tenant systém, ale neověřený modelový vstup. Nová implementace používá tentýž auth guard a guarded Prisma client, přidává explicitní organizationId a validaci aktivních zaměstnanců. Uživatelem dodané cizí ID se odmítne; neplatné ID z AI nahradí ověřený výchozí zaměstnanec, profil přihlášeného uživatele nebo první aktivní zaměstnanec podle původního pravidla. Bez aktivních zaměstnanců vrací 409.

## Implementované řešení

- Kliknutí → getUserMedia({ audio: true }) → MediaRecorder → multipart upload → Gemini → upravitelný text → původní parser úkolů.
- Žádná závislost na SpeechRecognition a žádné automatické vytvoření úkolů po přepisu.
- Stream, recorder, request, časovače a identifikátor relace jsou v refs. Aktivní relace blokuje souběh; stop callback má ochranu před opakovaným uploadem.
- Stop ukončí recorder a všechny tracks. Zavření/unmount zruší také síťový request a pozdní callbacks. Pozdě udělený stream se ihned vypne. Přepisy z předchozí relace se ignorují.
- MIME vyjednávání: WebM/Opus, WebM, MP4, default. Server přijímá audio/webm, audio/mp4, audio/ogg, audio/wav, audio/mpeg, audio/aac včetně codec parametrů.
- Limit nahrávání 120 sekund / 4 MB; server kontroluje skutečnou délku request streamu i souboru, nejen Content-Length.
- Transcription provider timeout 25 s, klient 30 s. Parser má společný 25s rozpočet napříč fallback modely, klient 35 s. Původní lokální textový fallback zůstává.
- Serverové chyby mají strukturovaný log s endpointem, organizationId, userId, fází, providerem, modelem a zprávou. UI nedostává stack trace ani raw provider chybu. Klíč je pouze na serveru v x-goog-api-key hlavičce.
- Stávající logAIUsage ukládá transcription metadata pouze s aktivní organizací, bez audia nebo přepisu. Audio se neukládá do DB ani souborového úložiště.
- Parser ověřuje i title, priority a datum. Vytváření checklistu je atomické v transakci.

## Provider a prohlížeče

Použit stávající Google Gemini REST generateContent, výchozí model `gemini-3.6-flash` podle konfigurace projektu. Serverová proměnná `GEMINI_TRANSCRIPTION_MODEL` umožňuje model změnit. Provider je izolován v `lib/ai-quick-task-transcription.ts`; API klíč získává z existujícího `getGeminiApiKey`.

Audio transcription a vstupní formáty jsou doloženy v oficiální dokumentaci:
- https://ai.google.dev/gemini-api/docs/generate-content/audio
- https://firebase.google.com/docs/ai-logic/input-file-requirements

Safari/iOS/PWA používá skutečný záznam a MP4, pokud jej browser nabízí. HTTPS a oprávnění mikrofonu jsou nutné. Nepodporovaný WebView zachová ruční textové zadání se srozumitelnou chybou. V repozitáři nebyla nalezena CSP ani Permissions-Policy zakazující mikrofon; middleware řeší session, PWA service worker neinterceptuje POST ani neukládá API odpovědi. Hlavičky případné externí proxy a reálná oprávnění zařízení nelze prokázat auditem zdrojového kódu.

## Navigace

Mobilní trigger v ResponsiveAppShell zůstává, desktopový je doplněn v AppTopbar. QuickInternalTasksView na `/my-tasks` i `/tasks` otevře přes React context stejný modal v shellu. Nové úkoly vyvolají router.refresh a view přebírá aktualizované props. Změna organizace remountuje modal.

## Změněné soubory

- components/tasks/AiQuickTaskModal.tsx
- components/tasks/useQuickTaskVoice.ts
- components/tasks/AiQuickTaskContext.tsx
- components/tasks/QuickInternalTasksView.tsx
- components/ResponsiveAppShell.tsx
- components/AppTopbar.tsx
- app/api/ai/transcribe-quick-task/route.ts
- app/api/ai/parse-quick-tasks/route.ts
- lib/quick-task-audio.ts
- lib/ai-quick-task-transcription.ts
- lib/quick-task-parsing.ts
- tests/quick-task-voice.test.ts
- e2e/quick-task-voice.spec.ts
- reports/quick-task-voice-audit.md

Existující uživatelské úpravy `lib/work.ts` a jiné rozpracované reporty nebyly měněny.

## Regresní ověření

Backendové testy spouštějí skutečné route handlery s mocky pouze na I/O hranicích: auth, databáze a provider. Pokrývají 401/403, cizí/absentní organizaci, prázdný/velký/nepodporovaný soubor, skutečný limit request streamu, chybu providera, timeout, ticho, český přepis, tenant metadata a hallucinated employee ID před DB zápisem. Samostatný test kontroluje skutečný provider payload, českou instrukci a klíč pouze v hlavičce.

Playwright načítá skutečný AiQuickTaskModal a mockuje mikrofon, MediaRecorder a API. Pokrývá start/stop, vypnutí tracks, unmount, pozdní povolení, duplicitní stop callback, MP4/WebM/default, chyby, editaci přepisu a následné vytvoření úkolů, ruční vytvoření po chybě mikrofonu, automatický stop po 120 sekundách a klientský timeout přepisu. Nejde o fyzický test mikrofonu nebo placené živé Gemini volání.

Finální výsledky:

| Kontrola | Výsledek |
| --- | --- |
| Nové backendové regresní testy | 13 prošlo |
| Celá sada `tsx --test tests/*.test.ts` | 796 prošlo, 4 přeskočené, 0 chyb (800 testů) |
| Playwright `e2e/quick-task-voice.spec.ts` | 15 prošlo, Chrome, 1,7 min |
| TypeScript `tsc --noEmit` | prošel |
| ESLint celého repozitáře | 0 chyb, 448 varování |
| `npm run build` (včetně Prisma generate) | prošel |
| Finální `next build` | prošel |
| `node scripts/check-tenant-security.mjs` | OK |

Reprodukce prohlížečového běhu ve Windows: `$env:E2E_BROWSER_CHANNEL='chrome'; node node_modules/@playwright/test/cli.js test e2e/quick-task-voice.spec.ts`. V tomto prostředí chyběl Playwright Chromium, proto byl použit instalovaný Chrome. Sandbox blokoval esbuild a některé kontrolní procesy; úspěšné finální běhy byly dokončeny mimo sandbox. Studený start Chrome vyčerpal první 60s limit testu; limit celého testu je 120 s, jednotlivé assertions mají původní timeout. Finální první scénář prošel za 40,9 s.

Výpisy kontrol: `reports/quick-task-voice-build.log`, `reports/quick-task-voice-build-final.log`, `reports/quick-task-voice-lint.log`, `reports/quick-task-voice-tests.log`, `reports/quick-task-voice-e2e.log`.

## Zbývající provozní ověření

Je nutný smoke test na fyzickém iPhonu v Safari i PWA a na Androidu, zejména udělení/odmítnutí oprávnění, přerušení nahrávání systémem a dostupnost nakonfigurovaného modelu v produkčním Gemini účtu. Testy provider mockují; negarantují přesnost přepisu jmen v hluku. Nahrávání má vědomě krátký limit a vyžaduje připojení pro přepis.

## Produkční nasazení — 19. 9. 2026

- Uživatel výslovně autorizoval nasazení v navazující zprávě.
- Produkce: https://seepoint.vercel.app
- Deployment: https://seepoint-llwdqqys7-pavels-projects-073588fb.vercel.app
- ID: `dpl_FrSDwxXvaKZgqCYj7gy2U1Cw6T5W`, target `production`, stav `READY`.
- Vercel remote build prošel (Next.js 15.5.25, produkční Node.js 24.x). Build obsahuje oba endpointy `/api/ai/transcribe-quick-task` a `/api/ai/parse-quick-tasks`.
- Základ `3da9f31ae3b92e84be8840274a51baff1f946916` byl shodný s předchozí produkcí `dpl_EUzuEDNeLTaDUYUkFd2afaJ88xA8`.
- Nasazen byl izolovaný zdrojový snapshot v `tmp/voice-production-release-20260919`: základ z Git archivu plus 13 souborů opravy a testů, shoda kopií ověřena přes SHA-256. Nevytvářel se nový Git commit.
- Rozpracovaná změna `lib/work.ts` nebyla zahrnuta; nasazený soubor má stejný Git blob hash jako původní produkční základ (`27f3e93a825e9ae950481692790b98a24be3523c`).
- Přítomnost `GEMINI_API_KEY` v production environment byla ověřena bez čtení hodnoty klíče.
- Po nasazení: `GET /login` → 200; oba AI endpointy při POST bez přihlášení → 401. Doména je přiřazena novému deploymentu.
- Fyzický mikrofon / autentizovaný živý přepis zůstávají neověřené podle výše uvedeného provozního omezení.
