import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import SectionCard from '../../components/Common/SectionCard';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/errors';
import { useApiAutoRefresh } from '../../hooks/useApiAutoRefresh';

interface EspacioCurricular {
  id: number;
  nombre: string;
  codigo: string;
  tipo_espacio: string;
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

export default function DocenteEspacios() {
  const [espacios, setEspacios] = useState<EspacioCurricular[]>([]);
  const [planEcs, setPlanEcs] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadData = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
    }

    try {
      const [espaciosRes, planEcsRes] = await Promise.all([
        api.get<EspacioCurricular[] | PaginatedResponse<EspacioCurricular>>('/espacios-asignados'),
        api.get<PaginatedResponse<PlanEstudioEC>>('/planes-estudio-ec'),
      ]);

      const espaciosData = Array.isArray(espaciosRes.data)
        ? espaciosRes.data
        : isPaginatedResponse<EspacioCurricular>(espaciosRes.data)
          ? espaciosRes.data.results
          : [];

      setEspacios(espaciosData);

      const map = new Map<number, number>();
      (planEcsRes.data.results || []).forEach((planEc) => {
        map.set(planEc.espacio_curricular, planEc.id);
      });
      setPlanEcs(map);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar tus espacios curriculares.'));
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useApiAutoRefresh(() => loadData(true), []);

  const handleSelectEspacio = (espacio: EspacioCurricular) => {
    const planEcId = planEcs.get(espacio.id);
    if (planEcId) {
      // Guardar en sessionStorage para usar en páginas de programas/actividades
      sessionStorage.setItem('selected_espacio_curricular_id', espacio.id.toString());
      sessionStorage.setItem('selected_plan_estudio_ec_id', planEcId.toString());
      sessionStorage.setItem('selected_espacio_nombre', espacio.nombre);
      
      // Ir a programas
      navigate('/docente/programas');
      return;
    }

    toast.error('No se encontró el plan de estudio asociado para este espacio. Contacta al administrador.');
  };

  if (loading) {
    return (
      <div className="content-empty">
        <p>Cargando espacios curriculares...</p>
      </div>
    );
  }

  if (espacios.length === 0) {
    return (
      <SectionCard title="Mis Espacios Curriculares">
        <div className="content-empty">
          <p>No tienes espacios curriculares asignados en este período.</p>
          <p className="text-sm text-muted mt-1">
            Contacta con el administrador para asignarte espacios.
          </p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Mis Espacios Curriculares">
      <p className="mb-3 text-muted">
        Selecciona un espacio curricular para continuar con tu planificación anual.
      </p>
      
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {espacios.map((espacio) => (
          <button
            key={espacio.id}
            onClick={() => handleSelectEspacio(espacio)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--muted)',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              transition: 'all 200ms ease',
            }}
            onMouseEnter={(e) => {
              const target = e.currentTarget as HTMLElement;
              target.style.backgroundColor = 'var(--ink)';
              target.style.color = 'var(--surface)';
              target.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget as HTMLElement;
              target.style.backgroundColor = 'var(--surface)';
              target.style.color = 'inherit';
              target.style.borderColor = 'var(--muted)';
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                {espacio.nombre}
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                {espacio.codigo} · Tipo: {espacio.tipo_espacio}
              </div>
            </div>
            <ChevronRight size={20} />
          </button>
        ))}
      </div>
    </SectionCard>
  );
}
