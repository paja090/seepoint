import { AppShell } from '@/components/AppShell';
import { PlannerSettings } from '@/components/planner/PlannerSettings';
import { requirePageAccess } from '@/lib/page-auth';
export default async function PlannerSettingsPage() { await requirePageAccess('planner'); return <AppShell><PlannerSettings /></AppShell>; }
