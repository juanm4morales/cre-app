import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import SectionCard from '../../components/Common/SectionCard';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

interface ProfileData {
  username: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  role: 'docente' | 'admin' | '';
  telefono: string;
}

function DocentePerfil() {
  const { user } = useAuth();

  const { data: profile, isLoading: loading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const response = await api.get('/auth/me');
      const data = response.data || {};
      return {
        username: data.username || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        name: data.name || user?.name || data.username || '',
        email: data.email || '',
        role: data.role || user?.role || '',
        telefono: data.telefono || data.phone || '',
      } satisfies ProfileData;
    },
    meta: { errorMessage: 'No se pudo cargar la información del perfil.' },
  });

  const fullName = useMemo(() => {
    if (!profile) return user?.name || 'Usuario';
    const fromParts = `${profile.first_name} ${profile.last_name}`.trim();
    if (fromParts) return fromParts;
    return profile.name || 'Usuario';
  }, [profile, user?.name]);

  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Perfil</p>
          <h2>Tu información</h2>
          <p>Este formulario refleja tus datos reales actuales. Próximamente podrás editarlos.</p>
        </div>
      </section>

      <SectionCard title="Datos personales">
        {loading ? (
          <p className="muted">Cargando información de perfil...</p>
        ) : (
          <form className="profile-form-grid" onSubmit={(event) => event.preventDefault()}>
            <label className="muted" htmlFor="perfil-nombre-completo">Nombre completo</label>
            <input
              id="perfil-nombre-completo"
              className="input"
              value={fullName}
              readOnly
            />

            <label className="muted" htmlFor="perfil-username">Usuario</label>
            <input
              id="perfil-username"
              className="input"
              value={profile?.username || 'Sin dato'}
              readOnly
            />

            <label className="muted" htmlFor="perfil-email">Correo electrónico</label>
            <input
              id="perfil-email"
              className="input"
              value={profile?.email || 'Sin dato'}
              readOnly
            />

            <label className="muted" htmlFor="perfil-rol">Rol</label>
            <input
              id="perfil-rol"
              className="input"
              value={profile?.role || 'Sin dato'}
              readOnly
            />

            <label className="muted" htmlFor="perfil-telefono">Teléfono</label>
            <input
              id="perfil-telefono"
              className="input"
              value={profile?.telefono || ''}
              placeholder="Próximamente editable"
              readOnly
            />

            <div className="profile-form-actions">
              <button className="button button-ghost" type="button" disabled>
                Editar perfil (próximamente)
              </button>
            </div>
          </form>
        )}
      </SectionCard>
    </>
  );
}

export default DocentePerfil;
