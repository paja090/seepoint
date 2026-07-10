export const roles = ['ADMIN', 'MANAGER', 'SALES', 'TECHNICIAN', 'WORKER', 'ACCOUNTANT', 'VIEWER'] as const;

export type AppRole = typeof roles[number];

export type MockUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
};

export type AppSection =
  | 'dashboard'
  | 'map'
  | 'carriers'
  | 'occupancy'
  | 'clients'
  | 'offers'
  | 'work'
  | 'employees'
  | 'tasks'
  | 'myTasks'
  | 'settlements'
  | 'mySettlements'
  | 'vehicles'
  | 'import'
  | 'settings';

const permissions: Record<AppRole, AppSection[]> = {
  ADMIN: ['dashboard', 'map', 'carriers', 'occupancy', 'clients', 'offers', 'work', 'employees', 'tasks', 'myTasks', 'settlements', 'mySettlements', 'vehicles', 'import', 'settings'],
  MANAGER: ['dashboard', 'map', 'carriers', 'work', 'employees', 'tasks', 'myTasks', 'settlements', 'mySettlements', 'vehicles'],
  SALES: ['dashboard', 'map', 'carriers', 'occupancy', 'clients', 'offers'],
  TECHNICIAN: ['dashboard', 'map', 'carriers', 'work', 'tasks', 'myTasks', 'vehicles'],
  WORKER: ['myTasks', 'mySettlements'],
  ACCOUNTANT: ['dashboard', 'employees', 'settlements', 'mySettlements'],
  VIEWER: ['dashboard', 'map', 'carriers'],
};

export function getCurrentUser(): MockUser {
  const configuredRole = process.env.MOCK_ROLE?.toUpperCase();
  const role = roles.includes(configuredRole as AppRole) ? configuredRole as AppRole : 'ADMIN';
  return {
    id: process.env.MOCK_USER_ID ?? 'mock-admin',
    name: process.env.MOCK_USER_NAME ?? 'Mock admin',
    email: process.env.MOCK_USER_EMAIL ?? 'admin@seepoint.local',
    role,
  };
}

export function canAccess(role: AppRole, section: AppSection) {
  return permissions[role].includes(section);
}

export function canViewSensitiveEmployeeData(role: AppRole) {
  return role === 'ADMIN' || role === 'MANAGER' || role === 'ACCOUNTANT';
}

export function canViewAllTasks(role: AppRole) {
  return role === 'ADMIN' || role === 'MANAGER' || role === 'TECHNICIAN';
}

export function canViewAllSettlements(role: AppRole) {
  return role === 'ADMIN' || role === 'MANAGER' || role === 'ACCOUNTANT';
}

export function roleLabel(role: AppRole | string) {
  const labels: Record<string, string> = {
    ADMIN: 'Admin',
    MANAGER: 'Manažer',
    SALES: 'Obchodník',
    TECHNICIAN: 'Technik',
    WORKER: 'Pracovník',
    ACCOUNTANT: 'Účetní',
    VIEWER: 'Náhled',
  };
  return labels[role] ?? role;
}

export function AccessDenied({ title = 'Nemáte oprávnění' }: { title?: string }) {
  return (
    <section className="card">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">Tahle část je dostupná jen oprávněným rolím. Oprávnění je zatím řízené mock uživatelem.</p>
    </section>
  );
}
