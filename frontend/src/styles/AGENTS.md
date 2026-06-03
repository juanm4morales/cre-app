# Styles agent notes

- Keep component dark styling behind `:root.dark`; unguarded `@media (prefers-color-scheme: dark)` in component CSS can override user-forced light mode when the OS is dark.
- Only `src/index.css` should use the system dark fallback, and guard it with `:root:not(.light)` so stored/manual light mode wins.
- `src/main.tsx` imports `index.css` before `App.tsx` imports `App.css`; put tokens in `index.css` and component styles in the files imported by `App.css`.
- Table visuals are split: base header/row hover rules live in `tables.css`, while mobile table spacing/overflow overrides live in `responsive.css`.
- For fixed-height flex layouts like the desktop sidebar, child containers need `min-height: 0` before an inner `overflow-y: auto` area will scroll instead of overlapping pinned footer controls.
- `docente.css` dashboard progress bars intentionally clamp fill width at 100%; excess is shown with `.track-overlimit` on the track. Letting the fill overflow the track caused visual regressions.
- The docente monthly activity chart is meant to fit all 28–31 days without horizontal scroll: `Dashboard.tsx` passes `--chart-cols`, and `.activity-chart-month` relies on tighter gaps/font sizes in `docente.css`.
