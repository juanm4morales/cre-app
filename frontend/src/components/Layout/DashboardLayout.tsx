import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileNav from './MobileNav';
import AnimatedPage from '../Common/AnimatedPage';

interface DashboardLayoutProps {
  role: 'docente' | 'admin';
}

function DashboardLayout({ role }: DashboardLayoutProps) {
  const appVersion = import.meta.env.VITE_APP_VERSION ?? 'dev';
  const environmentLabel = import.meta.env.MODE === 'production' ? 'Producción' : 'Desarrollo';

  return (
    <div className="app-shell">
      <Sidebar role={role} />
      <div className="app-main">
        <Topbar role={role} />
        <main className="app-content">
          <AnimatedPage>
            <Outlet />
          </AnimatedPage>
        </main>
        <footer className="app-footer" aria-label="Informacion de la aplicacion">
          <div className="app-footer-left">
            <strong>UNCuyo</strong>
            <span>CREAPP</span>
          </div>
          <div className="app-footer-right">
            <span>v{appVersion}</span>
            <span className="app-footer-separator">|</span>
            <span>{environmentLabel}</span>
          </div>
        </footer>
      </div>
      <MobileNav role={role} />
    </div>
  );
}

export default DashboardLayout;
