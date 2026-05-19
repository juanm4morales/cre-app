# Accounts agent notes

- `UserViewSet` is intentionally docente-only: it filters `profile__role="DOCENTE"` and `is_superuser=False`, creates users with docente profiles, and deletes by setting `is_active=False`.
- Frontend admin assignment screens rely on `/usuarios` returning assignable docentes; do not assume it lists admins or every auth user.
