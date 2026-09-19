# AI Radar production release — 2026-09-17

- PR: https://github.com/paja090/seepoint/pull/351
- Main: `ffc54f88d662496ac5583f04031d48d7f83f0e02`
- CI: https://github.com/paja090/seepoint/actions/runs/35277100445 — passed security, lint, TypeScript, tests and build; 782 passed, 4 skipped, 0 failed.
- Browser verification: desktop/mobile fixture test passed before release.
- Production migration: `20260917120000_radar_semantic_sources`, applied using Prisma Migrate before merge.
- Production Neon branch: `br-super-boat-at3cgqf3` in `royal-hat-94187799`.
- Migration rehearsal: `br-falling-water-atqfuo1j`, copy of production, auto-suspend 300 seconds.
- Recovery snapshot: `snap-delicate-sky-atlpnio0`.
- Before/after: 62 opportunities preserved, 160 → 169 source rows; zero missing legacy sources, invalid tenant links or merged opportunities.
- Migration history checksum normalized to committed LF file: `3fefb636aa97b22e07c3ffadebd7620577e4c60d5f5cb32b9d8c9604bfa7e23d`. The applied file had LF on the first 83 lines and CRLF on its final line; reconstructing exactly those endings reproduces the original checksum `8dbdc11d52ac2e8c63b8c856703e32575f9a1fda744b4f6c83f9744367978b52`. SQL content is identical. Normalization was conditional on that exact old checksum on both rehearsal and production branches.
- Final Prisma migrate status: database schema is up to date, 61 migrations.
- Unrelated local `lib/work.ts` changes excluded and preserved.
- Production deployment: `dpl_HYNk3N1zNTfMPGng2YStka7sJDPk`, READY, exact main commit, alias https://seepoint.vercel.app assigned without error.
- Production HTTP smoke: login 200, Radar page 307 to login, opportunity/duplicate/run APIs 401 without authentication. No runtime errors reported for those routes since deployment. This is not a signed-in production end-to-end test.
