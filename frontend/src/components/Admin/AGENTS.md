# Admin CRUD component notes

- `AdminCrudPage` accepts both array responses and DRF paginated `{ results }` responses; page components should not duplicate list parsing.
- Embedded CRUD sections use `showHeader={false}` and need their create button from the section action area, not a page header.
- Use `valueType="number"` for numeric FK selects and `emptyAs={null}` for optional date/FK fields so PATCH/POST payloads match DRF serializers.
