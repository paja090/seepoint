# Začínáme: firma a tým – evidence 10. 10. 2026

Šest lekcí v scripts/academy-onboarding-content.mjs: úvodní cesta, založení agentury (SUPER_ADMIN), firemní údaje, logo a barvy, evidence zaměstnance, pozvání kolegy.

Živě ověřeny stránky /onboarding, /settings/company, /settings/members a /employees. V QX promotion vytvořen výslovně školicí zaměstnanec AKADEMIE Ukázkový pracovník, academy.worker.20261010@example.invalid, role WORKER, bez přístupu, bez osobních a bankovních údajů. Zobrazen jeho detail a sekce odděleného přihlašovacího účtu. Nebyla odeslána žádná pozvánka ani změněno heslo, role reálného člověka nebo firemní nastavení.

Podklady: components/CreateOrganizationForm.tsx, components/OnboardingChecklist.tsx, components/CompanySettingsForm.tsx, components/EmployeeCreateForm.tsx, components/AccountAdmin.tsx, components/InviteOrganizationMemberForm.tsx a odpovídající API. Upozornění na neotestované odeslání/uložení je přímo u jednotlivých lekcí. Založení nové agentury nemá živou SUPER_ADMIN verifikaci ani screenshot a je MEDIA_PENDING. Pozvánka je MEDIA_PENDING, bezpečný výřez screenshotu se nepodařilo pořídit; soubor 23 se nepublikuje.

13 souvisejících testů prošlo. Nové lekce chrání příslušná organizační/platformní oprávnění, nikoli oprávnění k Nabídkám. Databázové migrace nejsou součástí.

Dříve publikovaných šest lekcí bylo obnoveno z původního nasazeného balíčku, protože aktuální HEAD je neobsahoval. Nový balíček vychází z aktuálního HEAD a doplňuje jen změny Akademie. Souběžné rozpracované změny app/api/photos/route.ts a lib/offers/service.ts se do něj nekopírují.
