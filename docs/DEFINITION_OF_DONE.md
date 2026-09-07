# SeePoint Definition of Done

Every new module must satisfy these checks before merge. Preserve Occupancy as occupancy source of truth; WorkTask/WorkEntry and Invoice/ClientInvoice are separate domains.

## Security
- [ ] Authentication
- [ ] Tenant isolation and organizationId from trusted context
- [ ] RBAC
- [ ] Backend SaaS module entitlement on pages, API and actions
- [ ] Foreign IDs tenant validated
- [ ] Public actions use validated, scoped authorization
- [ ] No known hardcoded secret for new credentials
- [ ] Security-sensitive events audited
- [ ] Existing permanent client URLs remain valid through every workflow stage

## Data
- [ ] organizationId and central tenant registry coverage
- [ ] Runtime validation
- [ ] Required indexes
- [ ] Tenant-scoped uniqueness constraints
- [ ] Safe incremental Prisma migration
- [ ] No destructive production data change without recovery plan

## Workflow
- [ ] Explicit statuses and allowed transitions
- [ ] Related writes in transactions
- [ ] Retry-sensitive actions idempotent or atomically reject replay
- [ ] Audit

## UI
- [ ] No fake KPI or client data
- [ ] Loading, empty and error states
- [ ] Responsive mobile experience

## Tests
- [ ] Happy path
- [ ] Invalid input
- [ ] RBAC
- [ ] Tenant isolation including foreign IDs
- [ ] Workflow transitions
- [ ] Regression test
- [ ] Integration/E2E where real database or browser behavior is material

## CI
- [ ] Tenant security
- [ ] Lint
- [ ] Typecheck
- [ ] Tests
- [ ] Production build
