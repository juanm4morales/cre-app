import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface DashboardLayoutProps {
  role: 'docente' | 'admin';
}

function DashboardLayout({ role }: DashboardLayoutProps) {
  const appVersion = import.meta.env.VITE_APP_VERSION ?? 'dev';
  const environmentLabel = import.meta.env.MODE === 'production' ? 'Produccion' : 'Desarrollo';

  return (
    <div className="app-shell">
      <Sidebar role={role} />
      <div className="app-main">
        <Topbar role={role} />
        <main className="app-content">
          <Outlet />
        </main>
        <footer className="app-footer" aria-label="Informacion de la aplicacion">
          <div className="app-footer-left">
            <strong>UNCuyo</strong>
            <span>CRE app</span>
          </div>
          <div className="app-footer-right">
            <span>v{appVersion}</span>
            <span className="app-footer-separator">|</span>
            <span>{environmentLabel}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default DashboardLayout;
