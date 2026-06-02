# Funcionalidades temporales para pruebas docentes

Estas capacidades se agregan para que los docentes puedan probar rápidamente la aplicación y diseñar su planificación sin esperar la carga institucional completa.

## Alcance temporal

- **Cargar créditos y horas IP/TA de espacios asignados** desde `/docente/espacios`.
- **Crear un espacio curricular y autoasignárselo** desde `/docente/espacios`.
- **Omitir/ocultar competencias** por defecto en `/docente/programas` para priorizar unidades y actividades.

## Endpoints temporales

- `POST /api/espacios-asignados/temporal/espacio`
  - Crea o reutiliza un espacio curricular por código.
  - Lo vincula a un plan de estudio (`PlanEstudioEC`).
  - Crea una `AsignacionDocente` vigente para el usuario docente autenticado.

- `PATCH /api/espacios-asignados/temporal/carga-horaria`
  - Permite al docente ajustar `creditos`, `horas_ip` y `horas_ta` de un espacio que tenga asignado.

## Advertencias

- Estas acciones escriben en tablas reales (`EspacioCurricular`, `PlanEstudioEC`, `AsignacionDocente`).
- La carga horaria de un espacio curricular puede impactar a otros usuarios si comparten el mismo espacio.
- Deben reemplazarse por integración/carga oficial cuando esté disponible la fuente institucional.

## Criterio de retiro

Retirar estos endpoints y controles UI cuando:

1. Los espacios curriculares lleguen desde el sistema académico oficial.
2. Las asignaciones docentes se sincronicen o administren centralmente.
3. Los créditos y horas IP/TA provengan de una fuente validada.
4. La trazabilidad por competencias vuelva a ser obligatoria para la planificación.
