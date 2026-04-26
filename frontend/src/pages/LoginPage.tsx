import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { getApiErrorMessage } from '../utils/errors';

function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const user = await login({ username: name || '', password });
      navigate(user.role === 'admin' ? '/admin' : '/docente');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo iniciar sesión. Verifica tus credenciales.'));
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img
          src="https://iconape.com/wp-content/png_logo_vector/universidad-nacional-de-cuyo-uncuyo-logo.png"
          alt="UNCuyo"
          className="auth-logo"
        />
        <p className="eyebrow">CRE APP</p>
        <h1>Ingreso a la plataforma</h1>
        <p className="muted">
          Accede para cargar programas, actividades y controlar los
          créditos.
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="muted" htmlFor="username-input">Usuario</label>
          <input
            id="username-input"
            className="input"
            type="text"
            placeholder="Usuario o email"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <label className="muted" htmlFor="password-input">Contraseña</label>
          <input
            id="password-input"
            className="input"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button className="button" type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <div className="chip-grid" style={{ marginTop: '1.4rem' }}>
          <span className="chip">Horas CRE centralizadas</span>
          <span className="chip">Alertas IP / TA</span>
          <span className="chip">Exportables rapidos</span>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
