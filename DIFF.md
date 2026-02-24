# Changelog

## 2026-02-23
- rerouted planning/execution into src/services/aiService.ts powered by OpenAI (adds openai@6.22.0).
- updated server.ts to proxy AI calls securely, included schema parsing helpers, and exposed OPENAI_API_KEY so Vite's build still works.
- refreshed AGENTS.md with Codex/creator guardrails plus DIFF.md tracking requirements.
- npm run build continues to emit straight into public_html for Apache to pick up instantly.
- added `aether.webcrafters.be` to `server.allowedHosts` in `vite.config.ts` so the Vite dev server accepts the mapped host and re-ran `npm run build`.
- aligned the Express production server with the new `public_html` build output so the same bundle (and CSS) gets served instead of the stale `dist`.
- loaded `.env` at runtime and now fail fast if `OPENAI_API_KEY` is missing so `/api/ai/plan` errors become actionable.
- switched the plan prompt to send `text.format` (with `name`, `type`, plus the `planSchema`) so the Responses API sees the required schema fields and rebuilt the bundle.
