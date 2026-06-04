# Backend agent notes

- Validate Django from `backend/` with `./.venv/bin/python manage.py check`; the system `python` may not have Django installed even when the project venv is ready.
- In Azure App Service SSH, the runnable Oryx tree is usually under `/tmp/<build-id>/` with `antenv/bin/python`; `/home/site/wwwroot` may only hold packaging artifacts, so run live `manage.py` imports/migrations from the temp build directory.
