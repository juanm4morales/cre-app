# Project agent notes

- Azure App Service deploys here are cross-stack: `frontend/vite.config.js`, `backend/config/settings.py` (`TEMPLATES`, `STATICFILES_DIRS`, `STATIC_URL`), `backend/config/urls.py`, and Azure workflows must stay aligned or the deploy can go green while the SPA serves broken assets/routes.
- If PostgreSQL stays private behind a VNet/private endpoint, switching between `SWA + App Service` and same-origin does not remove the backend's VNet requirement; only the frontend entrypoint changes, and App Service VNet Integration still needs a separate subnet and a paid tier.
- Treat `azure-same-origin` as a deploy variant derived from `azure`, not as a second product branch; land shared/product changes in `azure` first, then sync them forward.
- The intended branch-specific drift for `azure-same-origin` is concentrated in routing/deploy files (`backend/config/settings.py`, `backend/config/urls.py`, `frontend/src/App.tsx`, `frontend/vite.config.js`, and sometimes workflow/static-hosting config); wider diffs usually mean the branch was allowed to drift.
