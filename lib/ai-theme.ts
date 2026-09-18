/** AI workspaces share a theme; unrelated routes keep their existing appearance. */
const AI_WORKSPACES = [
  '/sales/opportunities', '/ai-inbox', '/commercial',
  '/occupancy/ai', '/clients/dashboard', '/crm/intelligence',
];

export function isAiWorkspace(pathname: string): boolean {
  return AI_WORKSPACES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
