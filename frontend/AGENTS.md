# Frontend agent notes

- Validate frontend changes from `frontend/` with `npm run typecheck && npm run build && npm test`; Vitest may print repeated `--localstorage-file` warnings that are non-fatal when tests pass.
- Theme bootstrapping is split: `index.html` adds `light`/`dark` to `<html>` before React, `src/hooks/useTheme.ts` toggles `cre_theme`, and `src/index.css` owns theme token fallbacks.
