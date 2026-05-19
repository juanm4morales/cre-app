import { NavLink, useLocation } from 'react-router-dom';
import { House, FolderKanban, ClipboardList, CalendarCheck2, CircleUserRound, BookOpen, UserCog, Layers, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface MobileNavProps {
  role: 'docente' | 'admin';
}

function MobileNav({ role }: MobileNavProps) {
  const location = useLocation();
  const { theme, toggle } = useTheme();

  const getDocenteItems = () => [
    { to: '/docente/resumen', label: 'Inicio', icon: House, exact: true },
    { to: '/docente/programas', label: 'Programas', icon: FolderKanban },
    { to: '/docente/agenda-cursado', label: 'Agenda', icon: ClipboardList, prefixes: ['/docente/planificacion'] },
    { to: '/docente/ejecucion-ip', label: 'Seguimiento', icon: CalendarCheck2 },
    { to: '/docente/perfil', label: 'Perfil', icon: CircleUserRound },
  ];

  const getAdminItems = () => [
    { to: '/admin', label: 'Inicio', icon: House, exact: true },
    { to: '/admin/programas', label: 'Programas', icon: BookOpen },
    { to: '/admin/actividades', label: 'Actividades', icon: ClipboardList },
    { to: '/admin/usuarios', label: 'Usuarios', icon: UserCog },
    { to: '/admin/reportes', label: 'Más', icon: Layers, prefixes: ['/admin/espacios', '/admin/carreras', '/admin/unidades', '/admin/tipos', '/admin/planes', '/admin/competencias', '/admin/asignaciones'] },
  ];

  const items = role === 'docente' ? getDocenteItems() : getAdminItems();

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ size?: number }>;
  exact?: boolean;
  prefixes?: string[];
}

const isActive = (item: NavItem) => {
    if (item.exact && location.pathname === item.to) return true;
    if (!item.exact && location.pathname.startsWith(item.to)) return true;
    if (item.prefixes && item.prefixes.some((p: string) => location.pathname.startsWith(p))) return true;
    return false;
  };

  return (
    <nav className="mobile-nav" aria-label="Navegación principal">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={`mobile-nav-item ${active ? 'active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="mobile-nav-icon">
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
            </span>
            <span>{item.label}</span>
          </NavLink>
        );
      })}
      <button
        className="mobile-nav-item"
        type="button"
        onClick={toggle}
        aria-label="Cambiar tema"
      >
        <span className="mobile-nav-icon">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </span>
        <span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
      </button>
    </nav>
  );
}

export default MobileNav;