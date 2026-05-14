import { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CalendarCheck2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  Gauge,
  House,
  Layers,
  School,
  Settings2,
  UserCog,
} from 'lucide-react';

interface NavLinkItem {
  label: string;
  icon: LucideIcon;
  to?: string;
  matchPrefixes?: string[];
  children?: NavLinkItem[];
}

interface NavGroup {
  title: string;
  links: NavLinkItem[];
}

const navConfig: Record<'docente' | 'admin', NavGroup[]> = {
  docente: [
    {
      title: 'Principal',
      links: [{ to: '/docente/resumen', label: 'Inicio', icon: House }],
    },
    {
      title: 'Planificacion docente',
      links: [
        {
          to: '/docente/programas',
          label: 'Programas',
          icon: FolderKanban,
        },
        {
          label: 'Planificacion',
          icon: ClipboardList,
          matchPrefixes: ['/docente/planificacion', '/docente/agenda-cursado', '/docente/dias-cursado'],
          children: [
            {
              to: '/docente/agenda-cursado',
              label: 'Agenda de cursado',
              icon: ClipboardList,
            },
            {
              to: '/docente/planificacion-ip',
              label: 'Interacción pedagógica',
              icon: ClipboardList,
            },
            {
              to: '/docente/planificacion-ta',
              label: 'Trabajo autónomo',
              icon: ClipboardList,
            },
          ],
        },
        {
          to: '/docente/ejecucion-ip',
          label: 'Seguimiento',
          icon: CalendarCheck2,
        },
      ],
    },
  ],
  admin: [
    {
      title: 'Principal',
      links: [{ to: '/admin', label: 'Inicio', icon: House }],
    },
    {
      title: 'Gestion',
      links: [
        { to: '/admin/programas', label: 'Programas', icon: BookOpen },
        { to: '/admin/actividades', label: 'Actividades', icon: ClipboardList },
        { to: '/admin/usuarios', label: 'Usuarios', icon: UserCog },
      ],
    },
    {
      title: 'Estructura Académica',
      links: [
        { to: '/admin/carreras', label: 'Carreras', icon: School },
        {
          to: '/admin/espacios-curriculares',
          label: 'Espacios curriculares',
          icon: BookOpen,
        },
        { to: '/admin/unidades-academicas', label: 'Unidades académicas', icon: Layers },
        { to: '/admin/tipos-actividad', label: 'Tipos de actividad', icon: Settings2 },
      ],
    },
    {
      title: 'Analítica',
      links: [{ to: '/admin/reportes', label: 'Reportes', icon: Gauge }],
    },
  ],
};

interface SidebarProps {
  role: 'docente' | 'admin';
}

const getNavLinkClassName = ({ isActive }: { isActive: boolean }) => {
  return isActive ? 'nav-link-active' : 'nav-link';
};

function isItemActive(pathname: string, item: NavLinkItem): boolean {
  if (item.to && pathname === item.to) {
    return true;
  }

  if (item.matchPrefixes?.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  return item.children?.some((child) => isItemActive(pathname, child)) ?? false;
}

function Sidebar({ role }: SidebarProps) {
  const location = useLocation();
  const groups = useMemo(() => navConfig[role] || [], [role]);
  const roleLabel = role === 'admin' ? 'Portal Administrativo' : 'Portal Docente';
  const [toggledItems, setToggledItems] = useState<Record<string, boolean>>({});

  const expandedItems = useMemo(() => {
    const auto: Record<string, boolean> = {};
    groups.forEach((group) => {
      group.links.forEach((item) => {
        if (item.children && isItemActive(location.pathname, item)) {
          auto[item.label] = true;
        }
      });
    });
    return { ...toggledItems, ...auto };
  }, [groups, location.pathname, toggledItems]);

  const handleToggleItem = (label: string) => {
    setToggledItems((previous) => ({ ...previous, [label]: !previous[label] }));
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <img
            src="https://iconape.com/wp-content/png_logo_vector/universidad-nacional-de-cuyo-uncuyo-logo.png"
            alt="UNCuyo"
            className="brand-logo"
          />
          <div className="brand-copy">
            <div className="brand-name">CRE app</div>
            <div className="brand-tag">Planificación académica</div>
            <div className="sidebar-role">{roleLabel}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div className="nav-group" key={group.title}>
              <div className="nav-group-title">{group.title}</div>
              {group.links.map((link) => {
                const Icon = link.icon;
                const isActive = isItemActive(location.pathname, link);

                if (link.children) {
                  const isExpanded = expandedItems[link.label] ?? isActive;

                  return (
                    <div className={`nav-item-stack ${isExpanded ? 'is-open' : ''}`} key={link.label}>
                      <button
                        className={isActive ? 'nav-parent-trigger nav-parent-active' : 'nav-parent-trigger'}
                        type="button"
                        onClick={() => handleToggleItem(link.label)}
                        aria-expanded={isExpanded}
                      >
                        <span className="nav-link-icon">
                          <Icon size={17} />
                        </span>
                        <span className="nav-link-copy">
                          <span className="nav-link-label">{link.label}</span>
                        </span>
                        <span className="nav-parent-chevron" aria-hidden="true">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>
                      </button>

                      {isExpanded ? (
                        <div className="nav-children">
                          {link.children.map((child) => {
                            const ChildIcon = child.icon;
                            const childIsActive = isItemActive(location.pathname, child);

                            return (
                              <NavLink
                                key={child.to}
                                to={child.to || '#'}
                                className={() => getNavLinkClassName({ isActive: childIsActive })}
                              >
                                <span className="nav-link-icon nav-link-icon-child">
                                  <ChildIcon size={15} />
                                </span>
                                <span className="nav-link-copy">
                                  <span className="nav-link-label">{child.label}</span>
                                </span>
                              </NavLink>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <NavLink
                    key={link.to}
                    to={link.to || '#'}
                    className={() => getNavLinkClassName({ isActive })}
                    end={link.to === `/${role}`}
                  >
                    <span className="nav-link-icon">
                      <Icon size={17} />
                    </span>
                    <span className="nav-link-copy">
                      <span className="nav-link-label">{link.label}</span>
                    </span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}

export default Sidebar;
