'use client';

import { useSyncExternalStore } from 'react';

const key = 'seepoint-sidebar-collapsed';
let memoryValue = false;
function snapshot() {
  try { memoryValue = localStorage.getItem(key) === 'true'; } catch { /* Private or restricted storage. */ }
  return memoryValue;
}
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('seepoint-sidebar-change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('seepoint-sidebar-change', callback);
  };
}
const serverSnapshot = () => false;

export function useSidebarPreference() {
  const collapsed = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return [collapsed, () => {
    memoryValue = !collapsed;
    try { localStorage.setItem(key, String(memoryValue)); } catch { /* Preserve preference for this session. */ }
    window.dispatchEvent(new Event('seepoint-sidebar-change'));
  }] as const;
}
