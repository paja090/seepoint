# Shared AI workspace theme

`lib/ai-theme.ts` identifies the AI Radar, Inbox, commercial center, occupancy AI,
and CRM intelligence routes. `ResponsiveAppShell` scopes `ai-theme` to their main
content, including the top bar. Navigation and unrelated pages retain their layout.

`app/ai-theme.css` owns the navy surfaces, readable text, emerald actions, violet AI
annotations, and warning/error colors. Its scoped compatibility selectors support
existing Tailwind variants without rewriting business components. No runtime style
generation, external UI dependency, API change, or database migration is involved.

For new AI panels, use `ai-theme` at the boundary, `ai-panel` for a surface,
`ai-primary` for the main action and `ai-secondary` for secondary actions. Prefer
the shared `--ai-*` variables to new hard-coded colors. Standalone dialogs must
carry `ai-theme` themselves because they can open outside an AI workspace.

Embedded client intelligence, enrichment, Inbox dashboard widget, offer generator,
quick task, warehouse AI import, fuel OCR and notification center also use the scope.
Original HTML emails use `ai-original-email`; their document colors are preserved.

Radar summaries and next actions remain visible. Native disclosure sections expose
the complete evidence and AI interpretation. Sources, duplicate review, manual merge,
keep separate and detach retain their existing API behavior and permissions.

Verification:

- `npm run typecheck`, `npm run lint`, `npm run security:tenant`, `npm test`
- `playwright test e2e/ai-theme.spec.ts e2e/radar-semantic-ui.spec.ts`

Browser fixtures render real components with synthetic data and mocked requests.
They check desktop/mobile layout, theme isolation, source document colors, keyboard
focus, standalone forms and the existing Radar review actions. They make no AI calls
or production mutations. An authenticated production visual check complements these
fixtures; fixtures do not cover every possible imported HTML document or data length.
