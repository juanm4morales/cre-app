# Workflow agent notes

- This repo has two Azure App Service deploy workflows, `deploy.yml` and `main_cre-app-api.yml`, targeting the same app; keep branch triggers and target settings in sync or Azure can keep deploying older code from the workflow still wired to the active branch.
- `frontend/public/staticwebapp.config.json` does not mean Azure Static Web Apps deploy is active; verify there is an actual `Azure/static-web-apps-deploy` workflow before assuming a branch is using SWA.
- `azure-same-origin` does not auto-deploy just because it was pushed; both current Azure App Service workflows filter on `main`/`azure`, so adding a new deploy branch requires updating both branch trigger lists.
- If the SWA deployment authorization policy is `GitHub`, `Azure/static-web-apps-deploy@v1` still needs the SWA API token but also requires `github_id_token`; without it Azure can misleadingly report `No matching Static Web App was found or the api key was invalid`.
- In `actions/github-script`, `core` is already in scope; declaring `const core = require('@actions/core')` inside the script causes `Identifier 'core' has already been declared`.
- The SWA workflow must build with `VITE_API_URL` set to the App Service `/api`, while the App Service workflow builds with `VITE_API_URL=/api` and `VITE_STATIC_BASE=/api/static/`.
- To disable SWA auto-deploy while keeping the workflow for PR previews, comment out the `push` block inside `on:`; there is no single boolean toggle for enabling/disabling a workflow trigger.
