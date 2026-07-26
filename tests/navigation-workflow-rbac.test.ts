import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED_STATUS_TRANSITIONS } from '../lib/navigation/workflow-service.ts';
import { canAccess, type AppRole } from '../lib/rbac.ts';
import { canManageOfferRole, canConvertOfferRole, canAccessOffer } from '../lib/offers/domain.ts';

describe('Modul NAVIGACE - Workflow a RBAC Testy', () => {
  it('ověřuje povolené přechody stavového automatu zakázky', () => {
    assert.equal(ALLOWED_STATUS_TRANSITIONS['POPTAVKA'].includes('NABIDKA'), true);
    assert.equal(ALLOWED_STATUS_TRANSITIONS['NABIDKA'].includes('POTVRZENO_KLIENTEM'), true);
    assert.equal(ALLOWED_STATUS_TRANSITIONS['POTVRZENO_KLIENTEM'].includes('SMLOUVA_OBJEDNAVKA'), true);
    assert.equal(ALLOWED_STATUS_TRANSITIONS['SMLOUVA_OBJEDNAVKA'].includes('GRAFICKE_PODKLADY'), true);
    assert.equal(ALLOWED_STATUS_TRANSITIONS['GRAFICKE_PODKLADY'].includes('SCHVALENI_GRAFIKY'), true);
    assert.equal(ALLOWED_STATUS_TRANSITIONS['SCHVALENI_GRAFIKY'].includes('TISK_VYROBA'), true);
    assert.equal(ALLOWED_STATUS_TRANSITIONS['TISK_VYROBA'].includes('PRIPRAVENO_K_INSTALACI'), true);
    assert.equal(ALLOWED_STATUS_TRANSITIONS['PRIPRAVENO_K_INSTALACI'].includes('INSTALACE'), true);
    assert.equal(ALLOWED_STATUS_TRANSITIONS['INSTALACE'].includes('FOTODOKUMENTACE'), true);
    assert.equal(ALLOWED_STATUS_TRANSITIONS['FOTODOKUMENTACE'].includes('PRIPRAVENO_K_FAKTURACI'), true);
    assert.equal(ALLOWED_STATUS_TRANSITIONS['PRIPRAVENO_K_FAKTURACI'].includes('FAKTUROVANO'), true);
    assert.equal(ALLOWED_STATUS_TRANSITIONS['FAKTUROVANO'].includes('DOKONCENO'), true);

    // Zakázaný přechod z POPTAVKA přímo do FAKTUROVANO
    assert.equal(ALLOWED_STATUS_TRANSITIONS['POPTAVKA'].includes('FAKTUROVANO'), false);
  });

  it('ověřuje oprávnění pro samostatnou roli SALES', () => {
    const salesRole: AppRole = 'SALES';

    // SALES má přístup ke svým nabídkám, zakázkám a mapě
    assert.equal(canAccess(salesRole, 'offers'), true);
    assert.equal(canAccess(salesRole, 'navigationProjects'), true);
    assert.equal(canAccess(salesRole, 'map'), true);
    assert.equal(canAccess(salesRole, 'clients'), true);

    // SALES NESMÍ do správy zaměstnanců, mezd ani nastavení
    assert.equal(canAccess(salesRole, 'employees'), false);
    assert.equal(canAccess(salesRole, 'settlements'), false);
    assert.equal(canAccess(salesRole, 'settings'), false);
    assert.equal(canAccess(salesRole, 'import'), false);

    // SALES může spravovat a převádět své nabídky
    assert.equal(canManageOfferRole(salesRole), true);
    assert.equal(canConvertOfferRole(salesRole), true);
  });

  it('ověřuje vlastnictví nabídky pro roli SALES', () => {
    const salesUser = { id: 'usr-sales-1', name: 'Obchodník Jan', email: 'sales@seepoint.cz', role: 'SALES' as const };
    const adminUser = { id: 'usr-admin-1', name: 'Admin', email: 'admin@seepoint.cz', role: 'ADMIN' as const };

    // Obchodník vidí svou vlastní nabídku
    assert.equal(canAccessOffer(salesUser, 'usr-sales-1'), true);
    // Obchodník NESMÍ upravovat cizí nabídku jiné obchodnice bez přístupu
    assert.equal(canAccessOffer(salesUser, 'usr-sales-2'), false);
    // Admin vidí jakoukoliv nabídku
    assert.equal(canAccessOffer(adminUser, 'usr-sales-2'), true);
  });
});
