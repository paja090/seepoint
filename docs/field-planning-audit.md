# Field planning audit — 2026-09-14

Audit before implementation: `/work` and `/work/[id]` use WorkOrder with carrier/surface items, assignments, and derived WorkTasks. `/work/route` is a transient Leaflet view with geographical nearest-neighbour ordering; it does not persist or reserve anything. Preserve the entry point.

* WorkOrder already has priority, deadlineAt, campaignDateFrom/To and estimatedHours. Reuse estimatedHours for service duration overrides. Multiple geographically distinct items must not be silently reduced to the first carrier.
* WorkAssignment identifies users/names; syncWorkOrderTasks is the canonical bridge to Employee and WorkTask, protects tasks with existing WorkEntry. Resolve identity by user ID where available, reject ambiguous legacy names.
* Employee has roles/positions, active state and employment dates. EmployeeAbsence uses inclusive calendar dates and APPROVED state. No individual shift model was found. Use explicit tenant workday configuration, no inferred company workday.
* VehicleReservation uses inclusive whole days, Serializable transactions, and derivedVehicleStatus. Extract/share reservation creation policy; do not introduce hourly reservations or change service statuses.
* WorkEntry has DRAFT → SUBMITTED → APPROVED/RETURNED with rates and settlement policy. Field completion must not manufacture approved payroll entries.
* Existing mobile WorkOrder status endpoint sets ftdSent on DONE and writes an APPROVED WorkEntry. The planner must not use this shortcut. Execution must preserve photo/billing readiness and use the existing WorkEntry submission UI.
* Photo/mobile-photos already implement storage, capture, upload and confirmation. NavigationPoint owns installedPhoto, installation state and issueReported; Navigation workflow remains authoritative. Standard AI Realization reads CrmRealization.claimNote; navigation adapter reads issueReported. Neither planning nor work completion may declare billing readiness.
* Tenant Prisma extension scopes models containing organizationId and tenant-aware nested creates/connects. It is not a substitute for validating raw foreign-key inputs or nested business references. New tenant models need registry coverage; the planner explicitly checks referenced canonical records and snapshot JSON references.
* requireApiAccess/requirePageAccess and module-policy enforce RBAC plus enabledModules/plan. Existing workRoute module is the feature gate; worker access is own approved-plan DTO only.
* CrmAuditLog supports generic entity/action/details and can audit planner events. UserAuditLog is account-specific and unsuitable. Notifications use composable providers with stable notification IDs; reuse this architecture.
* Google computeGoogleRoute is canonical. It currently uses traffic-unaware road routes; use it for every accepted leg and return leg. Missing API is explicitly estimated using tenant-configured fallback assumptions. No planner geocoding is necessary for V1: unknown or ambiguous GPS is unplannable, without inheriting CZ geocoder restrictions.

## Baseline

Before implementation: test suite 686 PASS / 0 FAIL / 1 SKIP (687 tests); TypeScript zero diagnostics; security:tenant PASS. Production build logged separately under output/field-planner-baseline-build.log.

## Persistence decision

Add OrganizationFieldPlanningProfile (validated JSON configuration) and FieldPlan (immutable input/output JSON snapshots, tenant/day/version and tenant/request uniqueness). Crews and stops are snapshot values referencing canonical IDs, not independent business entities. Add only optional WorkOrder planning constraints for hard windows, required employees/positions, vehicle need and predecessors. No EmployeeSkill, FieldWorker, FieldVehicle, FieldJob or Photo copies.
