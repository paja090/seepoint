# Dispečink práce – druhá etapa

Nová stránka /work/dispatch sjednocuje denní přehled montáží, navigací a terénních bodů. Rozlišuje čekající práci, rezervované body a problémy. Výběr otevírá současné plánovače přímo na stránce. Různé terénní akce se stále plánují samostatně; společné schvalování různých zdrojů v jednom návrhu zatím není implementováno.

Jednoduché zadání používá stávající ElectionCampaign, ElectionRemovalPoint a FieldWorkStep. Nepotřebuje termín, posádku ani vozidlo. Přesun vyžaduje potvrzený cíl a vytváří navazující kroky. Opakované odeslání stejného požadavku má stabilní identitu v rámci organizace a běží v opakovatelné serializovatelné transakci. Žádná migrace.

Přístup vyžaduje manažera/správce a modul výjezdů; terénní zadání navíc modul terénních akcí. Načítání i zápis používají explicitní tenant context. Původní plánovací URL a API zůstávají zachované.

Omezení první verze: standardní fronta respektuje limity současného adaptéru; terénní fronta zobrazuje maximálně 500 bodů a přehled 100 výjezdů s upozorněním při překročení. Detail uloženého terénního výjezdu odkazuje na existující správu akce. Mobilní realizace se v této etapě nemění.

Ověření: tests/dispatch-queue.test.ts (rezervace, problémy, zdroje, transport, opakování a oddělení organizací), tests/dispatch-queue.browser.mjs (mobilní ovládání a zadání na simulovaných datech), TypeScript a lint. Testy nezapisují do skutečné databáze. Preview není potvrzenou izolovanou kopií produkčních dat.
