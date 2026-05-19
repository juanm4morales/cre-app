import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import SectionCard from '../../components/Common/SectionCard';
import api from '../../services/api';

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
  const navigate = useNavigate();
  const [errorShown, _setErrorShown] = useState(false);

  const { data: espacios = [], isLoading: loadingEspacios } = useQuery({
    queryKey: ['espacios-asignados'],
    queryFn: () => api.get<EspacioCurricular[] | PaginatedResponse<EspacioCurricular>>('/espacios-asignados').then(res => {
      return Array.isArray(res.data)
        ? res.data
        : isPaginatedResponse<EspacioCurricular>(res.data)
          ? res.data.results
          : [];
    }),
  });

  const { data: planEcsData = [], isLoading: loadingPlanEcs } = useQuery({
    queryKey: ['planes-estudio-ec'],
    queryFn: () => api.get<PaginatedResponse<PlanEstudioEC>>('/planes-estudio-ec').then(res => res.data.results || []),
  });

  if (!errorShown) {
    // One-time toast on API error is handled by query error state
  }

  const loading = loadingEspacios || loadingPlanEcs;

  const planEcsMap = new Map<number, number>();
  planEcsData.forEach((planEc) => {
    planEcsMap.set(planEc.espacio_curricular, planEc.id);
  });

  const handleSelectEspacio = (espacio: EspacioCurricular) => {
    const planEcId = planEcsMap.get(espacio.id);
    if (planEcId) {
      sessionStorage.setItem('selected_espacio_curricular_id', espacio.id.toString());
      sessionStorage.setItem('selected_plan_estudio_ec_id', planEcId.toString());
      sessionStorage.setItem('selected_espacio_nombre', espacio.nombre);

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
        Seleccioná un espacio curricular para continuar con tu planificación anual.
      </p>

      <div className="flex-col gap-3">
        {espacios.map((espacio) => (
          <button
            key={espacio.id}
            onClick={() => handleSelectEspacio(espacio)}
            className="espacio-card"
          >
            <div className="flex-col" style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
              <span className="espacio-card-title">{espacio.nombre}</span>
              <span className="text-sm text-muted">
                {espacio.codigo} · Tipo: {espacio.tipo_espacio}
              </span>
            </div>
            <ChevronRight size={20} />
          </button>
        ))}
      </div>
    </SectionCard>
  );
}
