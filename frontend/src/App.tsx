import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute, UnauthorizedPage, NotFoundPage } from './components/ProtectedRoute';
import DashboardLayout from './components/Layout/DashboardLayout';
import './App.css';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DocenteDashboard = lazy(() => import('./pages/docente/Dashboard'));
const DocenteEspacios = lazy(() => import('./pages/docente/Espacios'));
const DocenteProgramas = lazy(() => import('./pages/docente/Programas'));
const DocenteDiasCursado = lazy(() => import('./pages/docente/DiasCursado'));
const DocenteActividades = lazy(() => import('./pages/docente/Actividades'));
const DocentePlanificacionIP = lazy(() => import('./pages/docente/PlanificacionIP'));
const DocentePlanificacionTA = lazy(() => import('./pages/docente/PlanificacionTA'));
const DocentePerfil = lazy(() => import('./pages/docente/Perfil'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProgramas = lazy(() => import('./pages/admin/Programas'));
const AdminActividades = lazy(() => import('./pages/admin/Actividades'));
const AdminUsuarios = lazy(() => import('./pages/admin/Usuarios'));
const AdminReportes = lazy(() => import('./pages/admin/Reportes'));
const AdminEspaciosCurriculares = lazy(() => import('./pages/admin/EspaciosCurriculares'));
const AdminCarreras = lazy(() => import('./pages/admin/Carreras'));
const AdminUnidadesAcademicas = lazy(() => import('./pages/admin/UnidadesAcademicas'));
const AdminTiposActividad = lazy(() => import('./pages/admin/TiposActividad'));
const AdminPlanesEstudio = lazy(() => import('./pages/admin/PlanesEstudio'));
const AdminCompetencias = lazy(() => import('./pages/admin/Competencias'));
const AdminAsignacionesDocentes = lazy(() => import('./pages/admin/AsignacionesDocentes'));

import { useAuth } from './contexts/AuthContext';

function IndexRedirect() {
  const { isAuthenticated, role, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={role === 'admin' ? '/admin' : '/docente'} replace />;
}

function RouteLoading() {
  return (
    <div className="route-loading">
      <p role="status" aria-live="polite">Cargando pantalla...</p>
    </div>
  );
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoading />}>{children}</Suspense>;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              fontFamily: '"Source Sans 3", sans-serif',
              fontSize: '0.9rem',
              borderRadius: '0.75rem',
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<LazyRoute><LoginPage /></LazyRoute>} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          <Route element={<ProtectedRoute requiredRole="docente" />}>
            <Route path="/docente" element={<DashboardLayout role="docente" />}>
              <Route index element={<Navigate to="resumen" replace />} />
              <Route path="resumen" element={<LazyRoute><DocenteDashboard /></LazyRoute>} />
              <Route path="espacios" element={<LazyRoute><DocenteEspacios /></LazyRoute>} />
              <Route path="programas" element={<LazyRoute><DocenteProgramas /></LazyRoute>} />
              <Route path="dias-cursado" element={<Navigate to="/docente/agenda-cursado" replace />} />
              <Route path="agenda-cursado" element={<LazyRoute><DocenteDiasCursado /></LazyRoute>} />
              <Route path="planificacion" element={<Navigate to="/docente/planificacion-ip" replace />} />
              <Route path="planificacion-ip" element={<LazyRoute><DocentePlanificacionIP /></LazyRoute>} />
              <Route path="planificacion-ta" element={<LazyRoute><DocentePlanificacionTA /></LazyRoute>} />
              <Route path="ejecucion-ip" element={<LazyRoute><DocenteActividades /></LazyRoute>} />
              <Route path="actividades" element={<Navigate to="/docente/planificacion-ta" replace />} />
              <Route path="perfil" element={<LazyRoute><DocentePerfil /></LazyRoute>} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute requiredRole="admin" />}>
            <Route path="/admin" element={<DashboardLayout role="admin" />}>
              <Route index element={<LazyRoute><AdminDashboard /></LazyRoute>} />
              <Route path="programas" element={<LazyRoute><AdminProgramas /></LazyRoute>} />
              <Route path="actividades" element={<LazyRoute><AdminActividades /></LazyRoute>} />
              <Route path="usuarios" element={<LazyRoute><AdminUsuarios /></LazyRoute>} />
              <Route path="espacios-curriculares" element={<LazyRoute><AdminEspaciosCurriculares /></LazyRoute>} />
              <Route path="carreras" element={<LazyRoute><AdminCarreras /></LazyRoute>} />
              <Route path="unidades-academicas" element={<LazyRoute><AdminUnidadesAcademicas /></LazyRoute>} />
              <Route path="tipos-actividad" element={<LazyRoute><AdminTiposActividad /></LazyRoute>} />
              <Route path="planes-estudio" element={<LazyRoute><AdminPlanesEstudio /></LazyRoute>} />
              <Route path="competencias" element={<LazyRoute><AdminCompetencias /></LazyRoute>} />
              <Route path="asignaciones-docentes" element={<LazyRoute><AdminAsignacionesDocentes /></LazyRoute>} />
              <Route path="reportes" element={<LazyRoute><AdminReportes /></LazyRoute>} />
            </Route>
          </Route>

          <Route path="/" element={<IndexRedirect />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
