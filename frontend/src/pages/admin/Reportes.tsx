import SectionCard from '../../components/Common/SectionCard';

function AdminReportes() {
  return (
    <>
      <section className="page-header">
        <div>
          <p className="eyebrow">Reportes</p>
          <h2>Indicadores y exportables</h2>
          <p>Genera reportes con analitica para decanatos y coordinaciones.</p>
        </div>
        <button className="button" type="button" onClick={() => window.print()}>
          Exportar PDF
        </button>
      </section>

      <SectionCard title="Resumen de indicadores">
        <div className="chip-grid">
          <span className="chip">Carga promedio: 31 CRE</span>
          <span className="chip">IP promedio T1: 29%</span>
          <span className="chip">TA promedio T2: 51%</span>
          <span className="chip">Balance general: OK</span>
        </div>
      </SectionCard>
    </>
  );
}

export default AdminReportes;
