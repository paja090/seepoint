import { AppShell } from '@/components/AppShell';
import { PlannerCockpit } from '@/components/planner/PlannerCockpit';
import { requirePageAccess } from '@/lib/page-auth';
export default async function PlannerPage() { await requirePageAccess('planner'); return <AppShell><PlannerCockpit /></AppShell>; }
