import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  requiredRole?: 'docente' | 'admin';
}

export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p role="status" aria-live="polite">Cargando aplicación...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}

export function UnauthorizedPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Acceso restringido</p>
        <h1>No tenés permisos para entrar</h1>
        <p className="muted">
          Tu rol actual no tiene acceso a esta ruta. Pedí a un admin el permiso
          correcto.
        </p>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">404</p>
        <h1>Página no encontrada</h1>
        <p className="muted">Revisá la URL o volvé al inicio.</p>
      </div>
    </div>
  );
}
