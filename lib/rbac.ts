import React from 'react';

export const roles = ['ADMIN', 'MANAGER', 'SALES', 'TECHNICIAN', 'WORKER', 'ACCOUNTANT', 'VIEWER'] as const;
export type AppRole = typeof roles[number];

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  allowedRoles?: AppRole[];
};

export type AppSection =
  | 'dashboard'
  | 'map'
  | 'carriers'
  | 'occupancy'
  | 'clients'
  | 'offers'
  | 'navigationProjects'
  | 'navigationContracts'
  | 'navigationContacts'
  | 'navigationDocumentation'
  | 'cityGallery'
  | 'work'
  | 'employees'
  | 'tasks'
  | 'myTasks'
  | 'settlements'
  | 'mySettlements'
  | 'vehicles'
  | 'import'
  | 'settings'
  | 'workEntries'
  | 'myWorkEntries';

const permissions: Record<AppRole, AppSection[]> = {
  ADMIN: [
    'dashboard',
    'map',
    'carriers',
    'occupancy',
    'clients',
    'offers',
    'navigationProjects',
    'navigationContracts',
    'navigationContacts',
    'navigationDocumentation',
    'cityGallery',
    'work',
    'employees',
    'tasks',
    'myTasks',
    'settlements',
    'mySettlements',
    'vehicles',
    'import',
    'settings',
    'workEntries',
    'myWorkEntries',
  ],
  MANAGER: [
    'dashboard',
    'map',
    'carriers',
    'occupancy',
    'clients',
    'offers',
    'navigationProjects',
    'navigationContracts',
    'navigationContacts',
    'navigationDocumentation',
    'cityGallery',
    'work',
    'employees',
    'tasks',
    'myTasks',
    'settlements',
    'mySettlements',
    'vehicles',
    'workEntries',
    'myWorkEntries',
  ],
  SALES: [
    'dashboard',
    'map',
    'carriers',
    'occupancy',
    'clients',
    'offers',
    'navigationProjects',
    'navigationContracts',
    'navigationContacts',
    'navigationDocumentation',
    'cityGallery',
    'mySettlements',
    'vehicles',
    'work',
  ],
  TECHNICIAN: [
    'dashboard',
    'map',
    'carriers',
    'work',
    'tasks',
    'myTasks',
    'vehicles',
    'myWorkEntries',
    'mySettlements',
    'navigationProjects',
    'navigationDocumentation',
  ],
  WORKER: [
    'dashboard',
    'work',
    'myTasks',
    'mySettlements',
    'myWorkEntries',
    'vehicles',
    'navigationProjects',
  ],
  ACCOUNTANT: [
    'dashboard',
    'employees',
    'settlements',
    'mySettlements',
    'workEntries',
  ],
  VIEWER: [
    'dashboard',
    'map',
    'carriers',
  ],
};

export function canAccess(role: AppRole | string, section: AppSection) {
  const rolePermissions = permissions[role as AppRole];
  if (!rolePermissions) return false;
  return rolePermissions.includes(section);
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
    ADMIN: 'Administrátor',
    MANAGER: 'Manažer',
    SALES: 'Obchodník',
    TECHNICIAN: 'Technik (Servisák)',
    WORKER: 'Pracovník (Montážník)',
    ACCOUNTANT: 'Účetní',
    VIEWER: 'Náhled',
  };

  return labels[role] ?? role;
}

export function AccessDenied({ title = 'Nemáte oprávnění' }: { title?: string }) {
  return React.createElement(
    'section',
    { className: 'card' },
    React.createElement('h1', { className: 'text-2xl font-bold' }, title),
    React.createElement('p', { className: 'mt-2 text-sm text-slate-600' }, 'Tahle část je dostupná jen oprávněným rolím.')
  );
}
