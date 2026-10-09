# Úplný index stránek

Generovaný index, nikoli důkaz funkčnosti. Role jsou pouze přímý section guard; platí navíc tenant, licence a pravidla konkrétní akce. Prázdný guard neznamená veřejný přístup.

| Route | Soubor | Přímý guard |
|---|---|---|
| `/activate/[token]` | `app/activate/[token]/page.tsx` |  |
| `/admin/organizations` | `app/admin/organizations/page.tsx` |  |
| `/admin/organizations/[id]` | `app/admin/organizations/[id]/page.tsx` |  |
| `/ai-inbox` | `app/ai-inbox/page.tsx` | canAccess(user.role, 'aiInbox')) { |
| `/analytics` | `app/analytics/page.tsx` | requirePageAccess('clients', 'analytics') |
| `/campaign/[token]` | `app/campaign/[token]/page.tsx` |  |
| `/carriers` | `app/carriers/page.tsx` | requirePageAccess('carriers') |
| `/carriers/[id]` | `app/carriers/[id]/page.tsx` | requirePageAccess('carriers') |
| `/chat` | `app/chat/page.tsx` | requirePageAccess('team') |
| `/client/navigation-documentation/[token]` | `app/client/navigation-documentation/[token]/page.tsx` |  |
| `/clients/dashboard` | `app/clients/dashboard/page.tsx` | requirePageAccess('clients') |
| `/clients` | `app/clients/page.tsx` | requirePageAccess('clients') |
| `/clients/[id]` | `app/clients/[id]/page.tsx` | requirePageAccess('clients') |
| `/commercial` | `app/commercial/page.tsx` | canAccess(user.role, 'commercial')) redirect('/dashboard') |
| `/crm/intelligence` | `app/crm/intelligence/page.tsx` | requirePageAccess('clients') |
| `/dashboard` | `app/dashboard/page.tsx` | requirePageAccess('dashboard') |
| `/election-removal/new` | `app/election-removal/new/page.tsx` |  |
| `/election-removal` | `app/election-removal/page.tsx` |  |
| `/election-removal/[id]` | `app/election-removal/[id]/page.tsx` |  |
| `/election-removal/[id]/plan` | `app/election-removal/[id]/plan/page.tsx` |  |
| `/election-removal/[id]/route` | `app/election-removal/[id]/route/page.tsx` |  |
| `/employees` | `app/employees/page.tsx` | requirePageAccess('employees'); canAccess(user.role, 'employees')) return <AppShell><AccessDenied /></AppShell> |
| `/employees/[id]` | `app/employees/[id]/page.tsx` | requirePageAccess('employees'); canAccess(user.role, 'employees')) return <AppShell><AccessDenied /></AppShell> |
| `/field-survey/new` | `app/field-survey/new/page.tsx` | requirePageAccess('fieldSurvey'); requirePageAccess('fieldSurvey') |
| `/field-survey` | `app/field-survey/page.tsx` | requirePageAccess('fieldSurvey') |
| `/field-survey/[id]` | `app/field-survey/[id]/page.tsx` | requirePageAccess('fieldSurvey') |
| `/forgot-password` | `app/forgot-password/page.tsx` |  |
| `/import` | `app/import/page.tsx` | requirePageAccess('import') |
| `/login` | `app/login/page.tsx` |  |
| `/map` | `app/map/page.tsx` | requirePageAccess('map') |
| `/mobile-field-survey` | `app/mobile-field-survey/page.tsx` | requirePageAccess('fieldSurvey') |
| `/mobile-field-survey/[surveyId]` | `app/mobile-field-survey/[surveyId]/page.tsx` | requirePageAccess('fieldSurvey') |
| `/mobile-photos` | `app/mobile-photos/page.tsx` | canAccess(user.role, 'navigationProjects') && !canAccess(user.role, 'carriers')) {; hasModuleAccess(user, 'navigation', 'navigationProjects'); hasModuleAccess(user, 'carriers', 'carriers') |
| `/mobile-surveys` | `app/mobile-surveys/page.tsx` | requirePageAccess('navigationProjects', 'mobileSurveys') |
| `/mobile-surveys/[id]` | `app/mobile-surveys/[id]/page.tsx` | requirePageAccess('navigationProjects', 'mobileSurveys') |
| `/module-unavailable` | `app/module-unavailable/page.tsx` |  |
| `/my-route` | `app/my-route/page.tsx` | requirePageAccess('myTasks', 'workRoute') |
| `/my-settlements` | `app/my-settlements/page.tsx` | requirePageAccess('mySettlements'); canAccess(user.role, 'mySettlements')) { |
| `/my-settlements/[id]` | `app/my-settlements/[id]/page.tsx` | requirePageAccess('mySettlements') |
| `/my-tasks` | `app/my-tasks/page.tsx` | requirePageAccess('myTasks'); canAccess(user.role, 'myTasks')) return <AppShell><AccessDenied /></AppShell>; hasModuleAccess(user, 'workRoute', 'myTasks') && <Link href="/my-route" className="block rounded-2xl bg-sky-700 p-5 text-lg font-bold text-white">Moje trasa dnes →</Link>} |
| `/my-work-entries` | `app/my-work-entries/page.tsx` | requirePageAccess('myWorkEntries'); canAccess(user.role, 'myWorkEntries')) { |
| `/nakupy` | `app/nakupy/page.tsx` |  |
| `/navigation/carriers/[id]` | `app/navigation/carriers/[id]/page.tsx` | requirePageAccess('navigationProjects') |
| `/navigation/contacts` | `app/navigation/contacts/page.tsx` | requirePageAccess('navigationContacts') |
| `/navigation/contracts` | `app/navigation/contracts/page.tsx` | requirePageAccess('navigationContracts') |
| `/navigation/documentation` | `app/navigation/documentation/page.tsx` | requirePageAccess('navigationDocumentation') |
| `/navigation/installations` | `app/navigation/installations/page.tsx` | requirePageAccess('navigationProjects') |
| `/navigation/installations/planning` | `app/navigation/installations/planning/page.tsx` | requirePageAccess('navigationProjects') |
| `/navigation/orders/[id]` | `app/navigation/orders/[id]/page.tsx` | requirePageAccess('navigationProjects') |
| `/navigation` | `app/navigation/page.tsx` | requirePageAccess('navigationProjects') |
| `/navigation/qc` | `app/navigation/qc/page.tsx` | requirePageAccess('navigationProjects') |
| `/network` | `app/network/page.tsx` | requirePageAccess('offers', 'network') |
| `/occupancy/ai` | `app/occupancy/ai/page.tsx` | canAccess(user.role, 'aiOccupancy')) { |
| `/occupancy` | `app/occupancy/page.tsx` | requirePageAccess('occupancy') |
| `/offer/[token]` | `app/offer/[token]/page.tsx` |  |
| `/offers/new/city-gallery` | `app/offers/new/city-gallery/page.tsx` | requirePageAccess('offers') |
| `/offers/new/navigation` | `app/offers/new/navigation/page.tsx` | requirePageAccess('offers') |
| `/offers/new` | `app/offers/new/page.tsx` | requirePageAccess('offers') |
| `/offers/new/standard` | `app/offers/new/standard/page.tsx` | requirePageAccess('offers') |
| `/offers` | `app/offers/page.tsx` | requirePageAccess('offers') |
| `/offers/templates` | `app/offers/templates/page.tsx` | requirePageAccess('offers') |
| `/offers/[id]/approval` | `app/offers/[id]/approval/page.tsx` | requirePageAccess('offers') |
| `/offers/[id]/city-gallery/edit` | `app/offers/[id]/city-gallery/edit/page.tsx` | requirePageAccess('offers') |
| `/offers/[id]/edit` | `app/offers/[id]/edit/page.tsx` | requirePageAccess('offers') |
| `/offers/[id]/navigation/edit` | `app/offers/[id]/navigation/edit/page.tsx` | requirePageAccess('offers') |
| `/offers/[id]` | `app/offers/[id]/page.tsx` | requirePageAccess('offers') |
| `/offers/[id]/planner` | `app/offers/[id]/planner/page.tsx` | requirePageAccess('offers') |
| `/offers/[id]/preview` | `app/offers/[id]/preview/page.tsx` | requirePageAccess('offers') |
| `/offers/[id]/pricing` | `app/offers/[id]/pricing/page.tsx` | requirePageAccess('offers') |
| `/onboarding` | `app/onboarding/page.tsx` |  |
| `/os` | `app/os/page.tsx` |  |
| `/p/[token]` | `app/p/[token]/page.tsx` |  |
| `/` | `app/page.tsx` |  |
| `/planner` | `app/planner/page.tsx` | requirePageAccess('planner') |
| `/production` | `app/production/page.tsx` | requirePageAccess('printProduction') |
| `/profile` | `app/profile/page.tsx` |  |
| `/projects/city-gallery` | `app/projects/city-gallery/page.tsx` | requirePageAccess('cityGallery') |
| `/projects/city-inventory` | `app/projects/city-inventory/page.tsx` | requirePageAccess('carriers', 'cityInventory') |
| `/projects/navigation` | `app/projects/navigation/page.tsx` | requirePageAccess('navigationProjects') |
| `/proposal/[token]` | `app/proposal/[token]/page.tsx` |  |
| `/qr/scan` | `app/qr/scan/page.tsx` | requirePageAccess('carriers') |
| `/qr/[code]` | `app/qr/[code]/page.tsx` |  |
| `/realization` | `app/realization/page.tsx` | requirePageAccess('realization') |
| `/realization/[id]` | `app/realization/[id]/page.tsx` | requirePageAccess('realization') |
| `/reset-password/[token]` | `app/reset-password/[token]/page.tsx` |  |
| `/sales/opportunities` | `app/sales/opportunities/page.tsx` | requirePageAccess('clients', 'salesRadar') |
| `/settings/carrier-types` | `app/settings/carrier-types/page.tsx` | requirePageAccess('settings') |
| `/settings/company` | `app/settings/company/page.tsx` |  |
| `/settings/email` | `app/settings/email/page.tsx` | requirePageAccess('settings') |
| `/settings/integrations` | `app/settings/integrations/page.tsx` | requirePageAccess('settings') |
| `/settings/members` | `app/settings/members/page.tsx` |  |
| `/settings` | `app/settings/page.tsx` | requirePageAccess('settings'); hasModuleAccess(user, 'planner', 'planner') && <div className="card mb-6"><a href="/settings/planner" className="font-bold text-sky-700">Calendar & Planner →</a><p className="text-sm text-slate-600">Osobní kalendáře, pracovní doba a soustředěná práce.</p></div>} |
| `/settings/planner` | `app/settings/planner/page.tsx` | requirePageAccess('planner') |
| `/settings/products` | `app/settings/products/page.tsx` | requirePageAccess('settings') |
| `/settings/work` | `app/settings/work/page.tsx` | requirePageAccess('settings') |
| `/settlements` | `app/settlements/page.tsx` | requirePageAccess('settlements') |
| `/settlements/[id]` | `app/settlements/[id]/page.tsx` | requirePageAccess('settlements') |
| `/shopping` | `app/shopping/page.tsx` | requirePageAccess('team', 'shopping') |
| `/tasks` | `app/tasks/page.tsx` | requirePageAccess('tasks') |
| `/team` | `app/team/page.tsx` | requirePageAccess('team') |
| `/vacations` | `app/vacations/page.tsx` | requirePageAccess('team', 'vacations') |
| `/vehicle-reservations` | `app/vehicle-reservations/page.tsx` | requirePageAccess('vehicles'); canAccess(user.role, 'vehicles')) return <AppShell><AccessDenied /></AppShell> |
| `/vehicles` | `app/vehicles/page.tsx` | requirePageAccess('vehicles'); canAccess(user.role, 'vehicles')) return <AppShell><AccessDenied /></AppShell> |
| `/vehicles/[id]` | `app/vehicles/[id]/page.tsx` | requirePageAccess('vehicles'); canAccess(user.role, 'vehicles')) return <AppShell><AccessDenied /></AppShell> |
| `/warehouse` | `app/warehouse/page.tsx` | requirePageAccess('warehouse') |
| `/warehouse/print-qr` | `app/warehouse/print-qr/page.tsx` | requirePageAccess('warehouse') |
| `/work` | `app/work/page.tsx` | requirePageAccess('work') |
| `/work/route` | `app/work/route/page.tsx` | requirePageAccess('work', 'workRoute') |
| `/work/[id]` | `app/work/[id]/page.tsx` | requirePageAccess('work'); hasModuleAccess(user, 'workRoute', 'work') && ['ADMIN', 'MANAGER'].includes(user.role) && <WorkItemsEditor workOrderId={order.id} carriers={carriers} realizations={realizations} items={order.items.map(i => ({ id: i.id, carrierId: i.carrierId, surfaceId: i.surfaceId, crmRealizationId: i.crmRealizationId, description: i.description, estimatedMinutes: i.estimatedMinutes, status: itemStatus(i), issue: i.issueNote ?? i.crmRealization?.claimNote ?? null }))} />} |
| `/work-entries` | `app/work-entries/page.tsx` | requirePageAccess('workEntries'); canAccess(user.role, 'workEntries')) { |
