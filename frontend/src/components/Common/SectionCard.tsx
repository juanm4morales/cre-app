import type { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

function SectionCard({ title, action, children }: SectionCardProps) {
  return (
    <section className="section-card">
      <div className="section-title">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export default SectionCard;
