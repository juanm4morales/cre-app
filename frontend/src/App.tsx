import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute, UnauthorizedPage, NotFoundPage } from './components/ProtectedRoute';
import DashboardLayout from './components/Layout/DashboardLayout';
import './App.css';

import LoginPage from './pages/LoginPage';
import DocenteDashboard from './pages/docente/Dashboard';
import DocenteEspacios from './pages/docente/Espacios';
import DocenteProgramas from './pages/docente/Programas';
import DocenteDiasCursado from './pages/docente/DiasCursado';
import DocenteActividades from './pages/docente/Actividades';
import DocentePlanificacionIP from './pages/docente/PlanificacionIP';
import DocentePlanificacionTA from './pages/docente/PlanificacionTA';
import DocentePerfil from './pages/docente/Perfil';
import AdminDashboard from './pages/admin/Dashboard';
import AdminProgramas from './pages/admin/Programas';
import AdminActividades from './pages/admin/Actividades';
import AdminUsuarios from './pages/admin/Usuarios';
import AdminReportes from './pages/admin/Reportes';
import AdminEspaciosCurriculares from './pages/admin/EspaciosCurriculares';
import AdminCarreras from './pages/admin/Carreras';
import AdminUnidadesAcademicas from './pages/admin/UnidadesAcademicas';
import AdminTiposActividad from './pages/admin/TiposActividad';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          <Route element={<ProtectedRoute requiredRole="docente" />}>
            <Route path="/docente" element={<DashboardLayout role="docente" />}>
              <Route index element={<Navigate to="programas" replace />} />
              <Route path="resumen" element={<DocenteDashboard />} />
              <Route path="espacios" element={<DocenteEspacios />} />
              <Route path="programas" element={<DocenteProgramas />} />
              <Route path="dias-cursado" element={<Navigate to="/docente/agenda-cursado" replace />} />
              <Route path="agenda-cursado" element={<DocenteDiasCursado />} />
              <Route path="planificacion" element={<Navigate to="/docente/planificacion-ip" replace />} />
              <Route path="planificacion-ip" element={<DocentePlanificacionIP />} />
              <Route path="planificacion-ta" element={<DocentePlanificacionTA />} />
              <Route path="ejecucion-ip" element={<DocenteActividades />} />
              <Route path="actividades" element={<Navigate to="/docente/planificacion-ta" replace />} />
              <Route path="perfil" element={<DocentePerfil />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute requiredRole="admin" />}>
            <Route path="/admin" element={<DashboardLayout role="admin" />}>
              <Route index element={<AdminDashboard />} />
              <Route path="programas" element={<AdminProgramas />} />
              <Route path="actividades" element={<AdminActividades />} />
              <Route path="usuarios" element={<AdminUsuarios />} />
              <Route path="espacios-curriculares" element={<AdminEspaciosCurriculares />} />
              <Route path="carreras" element={<AdminCarreras />} />
              <Route path="unidades-academicas" element={<AdminUnidadesAcademicas />} />
              <Route path="tipos-actividad" element={<AdminTiposActividad />} />
              <Route path="reportes" element={<AdminReportes />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/docente" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
