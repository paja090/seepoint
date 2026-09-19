# Radar manual merge hotfix — 2026-09-18

Production logs showed successful duplicate review requests followed by HTTP 429 at 05:07–05:11 UTC. The route incorrectly applied opportunityDiscovery (2 actions per IP/user pair per hour) to manual review and historical preview.

Fix: separate radarReview (60 per identity/pair per minute, 120 per IP) and radarBackfill (6 per identity/pair per minute, 20 per IP) policies; existing paid discovery limits unchanged. Errors and Retry-After are visible beside the affected proposal. No production data was merged during debugging.

Validation: actual POST route regression with exhausted discovery and backfill buckets, repeated merges, keep separate, detach, throttle and RBAC passed. Browser desktop/mobile test checks 429 followed by successful retry. TypeScript and targeted lint passed. Full CI: 783 passed, 4 skipped, 0 failed; security, lint, typecheck and build passed.

PR: https://github.com/paja090/seepoint/pull/352
Main: 0b3d8b48468d4afd4bae0360b47a2a27171aaf72
CI: https://github.com/paja090/seepoint/actions/runs/35310400243
Production deployment: dpl_RWoUccNMWvH7SeKXNCrZTcRfMnZ2 READY, exact main commit, seepoint.vercel.app alias assigned without error. Authenticated production merge was not executed; behavior verified through the actual route regression and browser fixtures.
No migration. Unrelated lib/work.ts edits preserved outside release.
