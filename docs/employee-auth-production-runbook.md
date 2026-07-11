# Produkční runbook: autentizace zaměstnanců

Tento dokument odděluje kódovou připravenost od produkčního zásahu. Žádný krok označený jako produkční se nesmí provést bez výslovného schválení odpovědné osoby.

## Stav produkční brány

| Kontrola | Stav |
| --- | --- |
| `DATABASE_URL` | ČEKÁ NA RUČNÍ OVĚŘENÍ VE VERCELU |
| `APP_URL` (produkční HTTPS URL) | ČEKÁ NA RUČNÍ OVĚŘENÍ VE VERCELU |
| `SEED_ADMIN_EMAIL` | ČEKÁ NA RUČNÍ OVĚŘENÍ VE VERCELU |
| `SEED_ADMIN_PASSWORD` (pouze dočasně pro seed) | ČEKÁ NA RUČNÍ OVĚŘENÍ VE VERCELU |
| `SEED_ADMIN_NAME` | ČEKÁ NA RUČNÍ OVĚŘENÍ VE VERCELU |
| `EMAIL_WEBHOOK_URL` | ČEKÁ NA RUČNÍ OVĚŘENÍ VE VERCELU |
| `EMAIL_WEBHOOK_SECRET` | ČEKÁ NA RUČNÍ OVĚŘENÍ VE VERCELU |
| Záloha PostgreSQL a ověřená obnova | ČEKÁ NA RUČNÍ OVĚŘENÍ VE VERCELU |

Hodnoty tajemství se nekopírují do ticketu, PR ani logů. Kontrolují se pouze názvy a výsledek validace.

## Rate limiting

Rate limiting používá PostgreSQL tabulku `RateLimitBucket`, takže je sdílený mezi Vercel serverless instancemi. Ukládá pouze SHA-256 klíče pro IP, identitu a jejich kombinaci; e-mail, token ani IP se neukládají otevřeně. Fixed-window buckety mají expiraci. S pravděpodobností 1 % požadavků se odstraní nejvýše 200 nejstarších expirovaných řádků. IP limit se vyhodnocuje jako první, takže náhodné identity z jedné IP nemohou neomezeně zakládat další buckety.

| Operace | Okno | IP | Identita | IP + identita |
| --- | ---: | ---: | ---: | ---: |
| Přihlášení | 15 minut | 30 | 10 | 8 |
| Zapomenuté heslo | 60 minut | 20 | 5 | 5 |
| Reset hesla | 60 minut | 20 | 8 | 6 |
| Aktivace | 60 minut | 20 | 8 | 6 |
| Nová pozvánka | 60 minut | 30 | 5 | 5 |

Při překročení vrací API `429`, českou obecnou zprávu, `Retry-After` a `Cache-Control: no-store`. Na Vercelu se důvěřuje pouze validní adrese z `x-vercel-forwarded-for`. Mimo Vercel jsou proxy hlavičky ignorovány, dokud není výslovně nastaveno `TRUST_PROXY_IP_HEADERS=1`.

## A. Před nasazením

1. Zajistit aktuální databázovou zálohu a prakticky ověřit postup obnovy.
2. Zapsat rollback bod: SHA posledního stabilního commitu a URL posledního stabilního Vercel deploymentu.
3. Pouze nad read-only připojením zaznamenat počty `User` a `Employee`; nevypisovat osobní údaje.
4. Ve Vercelu ručně ověřit všechny ENV z tabulky výše. `APP_URL` a `EMAIL_WEBHOOK_URL` musí být HTTPS.
5. V bezpečném administrativním prostředí spustit `node scripts/validate-production-env.mjs --require-seed`. Skript nic nemění v databázi a nevypisuje hodnoty.
6. Ověřit webhook testovací zprávou mimo produkční uživatelský tok. V logu nesmí být URL s tokenem.
7. Potvrdit, že migrace `20260711140000_employee_auth` a `20260711200000_auth_rate_limiting` jsou aditivní a starší migrace nebyly upraveny.

## B. Bezpečné pořadí uvedení

Nový kód nesmí být veřejně přepnut dříve, než databáze obsahuje nové tabulky. Doporučený postup je maintenance/řízené promotion:

1. Sestavit ověřený commit, ale zatím jej nepromovat na produkční doménu.
2. Zapnout krátké maintenance okno nebo jinak zastavit přístup uživatelů k dosavadní verzi.
3. Na schváleném produkčním připojení spustit `npx prisma migrate deploy`.
4. Ověřit pouze schéma a počty původních `User`/`Employee`; žádné záznamy se nesmí ztratit.
5. S dočasně nastavenými `SEED_ADMIN_*` spustit jednou `npx prisma db seed`.
6. Read-only kontrolou potvrdit alespoň jednoho aktivního ADMINa.
7. Teprve poté promovat připravený deployment a připojit produkční doménu.
8. Přihlásit admina a dokončit smoke testy. Až potom ukončit maintenance okno.
9. Odstranit `SEED_ADMIN_PASSWORD` z Vercelu a spustit `node scripts/validate-production-env.mjs --post-seed` v bezpečném provozním prostředí.

## C. Smoke test

- Přihlášení admina a následné skutečné odhlášení.
- Chybné údaje vrátí obecnou chybu; opakované pokusy dosáhnou `429` s `Retry-After`.
- Založení dočasného zaměstnance bez přístupu, poté povolení přístupu.
- Odeslání pozvánky, aktivace a kontrola přidělené role.
- Uživatel nesmí otevřít zakázanou stránku ani odpovídající API.
- Zapomenuté heslo vrací stejnou odpověď pro existující i neexistující e-mail.
- Reset hesla zneplatní předchozí session.
- Pozastavený účet a neaktivní zaměstnanec se nepřihlásí; obnovení funguje podle stavu hesla.
- MANAGER nemůže vytvořit/povýšit ADMINa ani spravovat ADMIN účet.
- Posledního aktivního ADMINa nelze pozastavit, deaktivovat ani zbavit role.
- V databázi jsou session, aktivační a resetovací tokeny pouze jako hashe.
- Rate-limit buckety neobsahují otevřené IP, e-mail ani token.

## D. Rollback

1. Vrátit aplikaci na zaznamenaný předchozí Vercel deployment.
2. Aditivní tabulky a sloupce automaticky nemažte; rollback schématu by byl samostatný schválený zásah.
3. Pokud nefunguje e-mailový webhook, zastavit nové pozvánky/reset, zachovat aplikaci v maintenance režimu a opravit webhook. Tokeny nevypisovat do produkčních logů.
4. Nouzový přístup admina obnovit pouze schváleným seedem se silným jednorázovým heslem. Po použití heslo rotovat a odstranit `SEED_ADMIN_PASSWORD`.
5. Pokud migrace selže, nezkoušet ruční mazání tabulek; uložit chybu bez tajemství a obnovit službu podle ověřeného DB rollback plánu.

## E. Po nasazení

- Odstranit `SEED_ADMIN_PASSWORD` a ověřit post-seed konfiguraci.
- Zkontrolovat `UserAuditLog` na očekávané akce bez citlivých hodnot.
- Zkontrolovat aplikační chyby; logy nesmí obsahovat hesla, session ani aktivační/resetovací URL.
- Zkontrolovat velikost a nejstarší `expiresAt` v `RateLimitBucket`; expirované záznamy se mají průběžně zmenšovat po dávkách.
- Deaktivovat testovací účty a uchovat jejich historická data.
- Zaznamenat výsledky smoke testu, čas promotion a rollback bod.
