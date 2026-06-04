# Frontend agent notes

- Validate frontend changes from `frontend/` with `npm run typecheck && npm run build && npm test`; Vitest may print repeated `--localstorage-file` warnings that are non-fatal when tests pass.
- Theme bootstrapping is split: `index.html` adds `light`/`dark` to `<html>` before React, `src/hooks/useTheme.ts` toggles `cre_theme`, and `src/index.css` owns theme token fallbacks.
- `src/services/api.ts` falls back to same-origin `'/api'`; use `VITE_API_URL` only for split-origin deployments, because a stale `frontend/.env.local` production URL silently bypasses current App Service routing.
- `/sadmin-creapp-panel` in `src/App.tsx` is only a redirect into Django admin, not a SPA screen. Keep it aligned with backend admin/login URLs and proxy-exempt paths.
