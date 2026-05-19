# Admin pages agent notes

- Catalog admin pages are thin wrappers around `components/Admin/AdminCrudPage`; keep endpoint fields, option loading, and custom renderers in page files.
- When a CRUD section mutates data used by another select on the same page, pass `onMutationSuccess` to refetch the React Query option source.
- `/usuarios` may return docentes with only `username` populated; assignment pages should label/fallback to username instead of filtering those users out.
