import { useEffect, useRef, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, CircleUserRound, LogOut } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import api, { APP_DATA_CHANGED_EVENT } from '../../services/api';

interface TopbarProps {
  role: 'docente' | 'admin';
}

interface EspacioCurricular {
  id: number;
  nombre: string;
  codigo: string;
}

interface PlanEstudioEC {
  id: number;
  plan_estudio: number;
  espacio_curricular: number;
}

interface PaginatedResponse<T> {
  results: T[];
}

function isPaginatedResponse<T>(value: unknown): value is PaginatedResponse<T> {
  return typeof value === 'object' && value !== null && 'results' in value && Array.isArray((value as PaginatedResponse<T>).results);
}

const ROUTE_LABELS: Record<string, string> = {
  '/docente/resumen': 'Inicio',
  '/docente/espacios': 'Selección de espacio',
  '/docente/programas': 'Programas',
  '/docente/agenda-cursado': 'Planificación / Agenda de cursado',
  '/docente/dias-cursado': 'Planificación / Agenda de cursado',
  '/docente/planificacion-ip': 'Planificación / Interacción pedagógica',
  '/docente/planificacion-ta': 'Planificación / Trabajo autónomo',
  '/docente/planificacion': 'Planificación',
  '/docente/ejecucion-ip': 'Seguimiento',
  '/docente/perfil': 'Mi cuenta',
  '/admin': 'Inicio',
  '/admin/programas': 'Programas',
  '/admin/actividades': 'Actividades',
  '/admin/usuarios': 'Usuarios',
  '/admin/espacios-curriculares': 'Espacios curriculares',
  '/admin/carreras': 'Carreras',
  '/admin/unidades-academicas': 'Unidades académicas',
  '/admin/tipos-actividad': 'Tipos de actividad',
  '/admin/reportes': 'Reportes',
};

const DOCENTE_REFRESH_PATHS = ['/docente/planificacion-ip', '/docente/planificacion-ta', '/docente/ejecucion-ip'];

function getCurrentSectionLabel(pathname: string): string {
  if (pathname.startsWith('/docente/planificacion-ip')) {
    return ROUTE_LABELS['/docente/planificacion-ip'] ?? 'Sección';
  }

  if (pathname.startsWith('/docente/planificacion-ta')) {
    return ROUTE_LABELS['/docente/planificacion-ta'] ?? 'Sección';
  }

  if (pathname.startsWith('/docente/agenda-cursado') || pathname.startsWith('/docente/dias-cursado')) {
    return ROUTE_LABELS['/docente/agenda-cursado'] ?? 'Sección';
  }

  if (pathname.startsWith('/docente/ejecucion-ip')) {
    return ROUTE_LABELS['/docente/ejecucion-ip'] ?? 'Sección';
  }

  return ROUTE_LABELS[pathname] || 'Sección';
}

function Topbar({ role }: TopbarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedEspacioId, setSelectedEspacioId] = useState<string>(
    () => (role === 'docente' ? sessionStorage.getItem('selected_espacio_curricular_id') || '' : '')
  );
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const roleLabel = role === 'admin' ? 'Gestión académica administrativa' : 'Gestión docente CRE';
  const roleLabelCompact = role === 'admin' ? 'Gestión admin CRE' : 'Gestión docente CRE';
  const currentSection = getCurrentSectionLabel(location.pathname);

  const shouldRefreshCurrentPath = (path: string) => {
    return DOCENTE_REFRESH_PATHS.some((refreshPath) => path.startsWith(refreshPath));
  };

  const { data: espacios = [] } = useQuery({
    queryKey: ['espacios-asignados'],
    queryFn: () => api.get<EspacioCurricular[] | PaginatedResponse<EspacioCurricular>>('/espacios-asignados').then(res => {
      return Array.isArray(res.data)
        ? res.data
        : isPaginatedResponse<EspacioCurricular>(res.data)
          ? res.data.results
          : [];
    }),
    enabled: role === 'docente',
  });

  const { data: planEcsData = [] } = useQuery({
    queryKey: ['planes-estudio-ec'],
    queryFn: () => api.get<{ results: PlanEstudioEC[] }>('/planes-estudio-ec').then(res => res.data.results || []),
    enabled: role === 'docente',
  });

  const planEcs = useMemo(() => {
    const relationMap = new Map<number, number>();
    planEcsData.forEach((planEc) => {
      relationMap.set(planEc.espacio_curricular, planEc.id);
    });
    return relationMap;
  }, [planEcsData]);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!accountMenuRef.current) {
        return;
      }

      if (!accountMenuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChangeEspacio = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const espacioId = event.target.value;
    if (!espacioId) return;

    const espacio = espacios.find((item) => item.id === Number(espacioId));
    const planEcId = planEcs.get(Number(espacioId));

    if (!espacio || !planEcId) {
      toast.error('Este espacio no tiene un plan de estudio asociado. Contactá a administración.');
      return;
    }

    sessionStorage.setItem('selected_espacio_curricular_id', espacioId);
    sessionStorage.setItem('selected_plan_estudio_ec_id', String(planEcId));
    sessionStorage.setItem('selected_espacio_nombre', espacio.nombre);
    setSelectedEspacioId(espacioId);

    if (shouldRefreshCurrentPath(location.pathname)) {
      window.dispatchEvent(
        new CustomEvent(APP_DATA_CHANGED_EVENT, {
          detail: { method: 'LOCAL', url: 'space-selection' },
        })
      );

      navigate(location.pathname, { replace: true });
    } else {
      navigate('/docente/programas');
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-head">
        <h1 className="topbar-title">CRE app</h1>
        <div className="topbar-subtitle">
          <span className="topbar-role-label topbar-role-label-long">{roleLabel}</span>
          <span className="topbar-role-label topbar-role-label-short">{roleLabelCompact}</span>
          <span className="topbar-subtitle-separator"> | </span>
          <span>{user?.name || 'Usuario'}</span>
        </div>
        <div className="topbar-subtitle topbar-subtitle-space">
          {role === 'admin' ? 'Admin' : 'Docente'} / {currentSection}
        </div>
      </div>
      <div className="topbar-actions">
        {role === 'docente' && espacios.length > 0 ? (
          <select
            className="select topbar-espacio-select"
            value={selectedEspacioId}
            onChange={handleChangeEspacio}
          >
            <option value="">Seleccionar espacio curricular</option>
            {espacios.map((espacio) => (
              <option key={espacio.id} value={espacio.id}>
                {espacio.codigo} - {espacio.nombre}
              </option>
            ))}
          </select>
        ) : null}
        <span className="pill">Periodo {new Date().getFullYear()}</span>

        <div className="account-menu" ref={accountMenuRef}>
          <button
            className="button button-ghost account-menu-trigger"
            type="button"
            onClick={() => setIsAccountMenuOpen((prev) => !prev)}
            aria-expanded={isAccountMenuOpen}
            aria-haspopup="menu"
          >
            <CircleUserRound size={16} />
            <span>{user?.name || 'Mi cuenta'}</span>
            <ChevronDown size={15} />
          </button>

          {isAccountMenuOpen ? (
            <div className="account-menu-dropdown" role="menu" aria-label="Menú de cuenta">
              {role === 'docente' ? (
                <button
                  className="account-menu-item"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    navigate('/docente/perfil');
                  }}
                >
                  <CircleUserRound size={15} />
                  Mi cuenta
                </button>
              ) : null}
              <button
                className="account-menu-item"
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsAccountMenuOpen(false);
                  void logout();
                }}
              >
                <LogOut size={15} />
                Salir
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
