# Dispatch planning: phase 1 preview

This preview fixes inconsistent approval and planning defaults. No schema changes or production data migrations.

- Standard planning allows approving the feasible portion, with unassigned work and reasons shown before approval. Conflicts, missing prerequisites, stale snapshots and unavailable people/vehicles remain blockers.
- Only crews present in the actual route reserve employee availability.
- Stops link to the correct work, navigation or field campaign detail; warehouse/unknown stops have no invalid link.
- Today/tomorrow and field campaign planning use the organization timezone. Missing depot coordinates are not replaced with Prague; zero coordinates and Czech decimal input are handled explicitly.

## Verification

Automated engine and service regressions cover partial approval, missing dependencies, conflict rejection, retry idempotency, unused crew availability, date boundaries/DST and depot input. No production work is approved by these tests.

For preview acceptance, use isolated test data: two crews, one feasible and one missing-GPS job; confirm only the feasible job is assigned, then correct the other job and plan it separately. Check vehicle/absence conflicts, multi-step material transfers, and simultaneous approval by two dispatchers before production promotion.

## Following phases

The unified dispatch queue, optional work-order scheduling and redesigned mobile workflow are not part of this patch. Those require separate integration work and acceptance scenarios. Keep the existing routes and APIs during the transition. Any future schema change must be checked on an isolated database first.
