# Layout agent notes

- Route/nav labels are duplicated across `Sidebar.tsx`, `MobileNav.tsx`, and `Topbar.tsx` (`ROUTE_LABELS`); route or label changes usually need all three updated.
- `DashboardLayout.tsx` always renders `Sidebar`, `Topbar`, and `MobileNav`; `responsive.css` hides the sidebar and shows the bottom nav at the mobile breakpoint.
- `MobileNav.tsx` keeps admin mobile navigation to five items: its `prefixes` can mark admin catalog routes active, but they do not create direct navigation entries.
- Desktop sidebar height is fixed to the viewport; adding admin nav items should keep `.sidebar-nav` as the internal scroll area and leave the theme toggle outside/pinned.
