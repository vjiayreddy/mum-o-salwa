# Agents

This project uses the Payload CMS skill at `.agents/skills/payload/`.
Start with `.agents/skills/payload/SKILL.md` for a quick reference, then see `.agents/skills/payload/reference/` for detailed docs.

## Backend

Payload (`pnpm dev` → `:3000`) is the sole API. Do not revive or document Express (`rsap/api`) as a runtime dependency. Expo cutover map: `docs/EXPO_API_CUTOVER.md` and `src/commerce/cutover.ts`.
