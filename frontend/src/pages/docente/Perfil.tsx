import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import SectionCard from '../../components/Common/SectionCard';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { getApiErrorMessage } from '../../utils/errors';
import { useApiAutoRefresh } from '../../hooks/useApiAutoRefresh';

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
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData>({
    username: '',
    first_name: '',
    last_name: '',
    name: user?.name || '',
    email: '',
    role: user?.role || '',
    telefono: '',
  });

  const loadProfile = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
    }

    try {
      const response = await api.get('/auth/me');
      const data = response.data || {};

      setProfile({
        username: data.username || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        name: data.name || user?.name || data.username || '',
        email: data.email || '',
        role: data.role || user?.role || '',
        telefono: data.telefono || data.phone || '',
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar la información del perfil.'));
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, [user?.name, user?.role]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useApiAutoRefresh(() => loadProfile(true), [user?.name, user?.role]);

  const fullName = useMemo(() => {
    const fromParts = `${profile.first_name} ${profile.last_name}`.trim();
    if (fromParts) {
      return fromParts;
    }
    return profile.name || 'Usuario';
  }, [profile.first_name, profile.last_name, profile.name]);

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
              value={profile.username || 'Sin dato'}
              readOnly
            />

            <label className="muted" htmlFor="perfil-email">Correo electrónico</label>
            <input
              id="perfil-email"
              className="input"
              value={profile.email || 'Sin dato'}
              readOnly
            />

            <label className="muted" htmlFor="perfil-rol">Rol</label>
            <input
              id="perfil-rol"
              className="input"
              value={profile.role || 'Sin dato'}
              readOnly
            />

            <label className="muted" htmlFor="perfil-telefono">Teléfono</label>
            <input
              id="perfil-telefono"
              className="input"
              value={profile.telefono || ''}
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
