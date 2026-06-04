# Accounts agent notes

- `UserViewSet` is intentionally docente-only: it filters `profile__role="DOCENTE"` and `is_superuser=False`, creates users with docente profiles, and deletes by setting `is_active=False`.
- Frontend admin assignment screens rely on `/usuarios` returning assignable docentes; do not assume it lists admins or every auth user.
- `get_available_roles()` is the real SPA entry gate: `is_staff`/`is_superuser` users become SPA admins there, and the frontend largely trusts `/auth/login` and `/auth/me`. Restricting Django-admin-only users requires coordinated backend and frontend auth changes.
