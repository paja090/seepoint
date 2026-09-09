import { isModuleEnabled } from './organization-modules';
import { canAccess, type AppSection } from './rbac';

export const SECTION_MODULES: Partial<Record<AppSection, string>> = {
  map: 'carriers', clients: 'crm', billing: 'crm', navigationProjects: 'navigation',
  navigationContracts: 'navigation', navigationContacts: 'navigation', navigationDocumentation: 'navigation',
  team: 'employees', mySettlements: 'settlements', workEntries: 'work', myWorkEntries: 'work',
};
const MODULE_SECTIONS: Record<string, AppSection> = {
  crm: 'clients', navigation: 'navigationProjects', mobileSurveys: 'carriers',
  workRoute: 'work', vacations: 'dashboard', salesRadar: 'offers', analytics: 'clients',
  network: 'offers', cityInventory: 'carriers', shopping: 'dashboard',
};
export function moduleForSection(section: AppSection) { return SECTION_MODULES[section] ?? (section === 'settings' ? null : section); }

export function hasModuleAccess(user: {
  role: string; organizationId?: string | null;
  organization?: { id: string; isActive: boolean; plan?: string | null; enabledModules?: unknown } | null;
  membership?: { organizationId: string; isActive: boolean } | null;
} | null, moduleId: string, section?: AppSection): boolean {
  return Boolean(user?.organizationId && user.organization?.isActive && user.membership?.isActive
    && user.organization.id === user.organizationId && user.membership.organizationId === user.organizationId
    && isModuleEnabled(user.organization, moduleId)
    && canAccess(user.role, section ?? MODULE_SECTIONS[moduleId] ?? moduleId as AppSection));
}
