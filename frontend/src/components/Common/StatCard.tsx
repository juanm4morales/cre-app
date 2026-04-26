import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: ReactNode;
  footer?: ReactNode;
}

function StatCard({ title, value, footer }: StatCardProps) {
  return (
    <div className="stat-card">
      <h3>{title}</h3>
      <div className="stat-value">{value}</div>
      {footer ? <div className="stat-footer">{footer}</div> : null}
    </div>
  );
}

export default StatCard;
