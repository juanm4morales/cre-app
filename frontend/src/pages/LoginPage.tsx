import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { getApiErrorMessage } from '../utils/errors';

const loginSchema = z.object({
  username: z.string().min(1, 'El usuario es requerido'),
  password: z.string().min(1, 'La contraseña es requerida'),
  role: z.enum(['docente', 'admin']),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginPage() {
  const { login, loading, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
      role: 'docente',
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate(role === 'admin' ? '/admin' : '/docente', { replace: true });
    }
  }, [isAuthenticated, role, navigate]);

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const user = await login({ username: data.username, password: data.password, role: data.role });
      navigate(user.role === 'admin' ? '/admin' : '/docente');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo iniciar sesión. Verifica tus credenciales.'));
    }
  };

  return (
    <div className="auth-page">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <img
          src="https://iconape.com/wp-content/png_logo_vector/universidad-nacional-de-cuyo-uncuyo-logo.png"
          alt="UNCuyo"
          className="auth-logo"
        />
        <p className="eyebrow">CRE APP</p>
        <h1>Ingreso a la plataforma</h1>
        <p className="muted">
          Accedé para cargar programas, actividades y controlar los
          créditos.
        </p>
        <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="username-input">Usuario</label>
            <input
              id="username-input"
              className={`input ${errors.username ? 'input-error' : ''}`}
              type="text"
              placeholder="Usuario o email"
              autoComplete="username"
              aria-invalid={errors.username ? 'true' : 'false'}
              aria-describedby={errors.username ? 'username-error' : undefined}
              {...register('username')}
            />
            {errors.username && (
              <span id="username-error" className="error-text" role="alert">
                {errors.username.message}
              </span>
            )}
          </div>
          <div>
            <label htmlFor="role-input">Ingresar como</label>
            <select
              id="role-input"
              className={`input ${errors.role ? 'input-error' : ''}`}
              aria-invalid={errors.role ? 'true' : 'false'}
              aria-describedby={errors.role ? 'role-error' : undefined}
              {...register('role')}
            >
              <option value="docente">Docente</option>
              <option value="admin">Administrador</option>
            </select>
            {errors.role && (
              <span id="role-error" className="error-text" role="alert">
                {errors.role.message}
              </span>
            )}
          </div>
          <div>
            <label htmlFor="password-input">Contraseña</label>
            <input
              id="password-input"
              className={`input ${errors.password ? 'input-error' : ''}`}
              type="password"
              placeholder="Contraseña"
              autoComplete="current-password"
              aria-invalid={errors.password ? 'true' : 'false'}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            {errors.password && (
              <span id="password-error" className="error-text" role="alert">
                {errors.password.message}
              </span>
            )}
          </div>
          <button className="button" type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <div className="chip-grid mt-4">
          <span className="chip">Horas CRE centralizadas</span>
          <span className="chip">Alertas IP / TA</span>
          <span className="chip">Exportables rápidos</span>
        </div>
        </motion.div>
    </div>
  );
}

export default LoginPage;
