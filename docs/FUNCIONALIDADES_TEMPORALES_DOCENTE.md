# Funcionalidades temporales para pruebas docentes

Estas capacidades se agregan para que los docentes puedan probar rápidamente la aplicación y diseñar su planificación sin esperar la carga institucional completa.

## Alcance temporal

- **Cargar horas IP/TA de espacios asignados** desde `/docente/espacios`; los créditos se calculan automáticamente con la equivalencia horas/CRE configurada.
- **Crear un espacio curricular y autoasignárselo** desde `/docente/espacios`.
- **Autoasignarse un espacio curricular ya creado** desde `/docente/espacios`, vinculándolo al plan de estudio seleccionado.
- **Omitir/ocultar competencias** por defecto en `/docente/programas` para priorizar unidades y actividades.

## Endpoints temporales

- `POST /api/espacios-asignados/temporal/espacio`
  - Crea o reutiliza un espacio curricular por código.
  - Lo vincula a un plan de estudio (`PlanEstudioEC`).
  - Crea una `AsignacionDocente` vigente para el usuario docente autenticado.
  - Recalcula `creditos = techo((horas_ip + horas_ta) / horas_por_cre)`; el docente no ingresa créditos manualmente.

- `PATCH /api/espacios-asignados/temporal/carga-horaria`
  - Permite al docente ajustar `horas_ip` y `horas_ta` de un espacio que tenga asignado.
  - Recalcula `creditos = techo((horas_ip + horas_ta) / horas_por_cre)`.

- `POST /api/espacios-asignados/temporal/asignarme`
  - Permite al docente autoasignarse un `EspacioCurricular` existente.
  - Crea la relación `PlanEstudioEC` con el plan seleccionado si todavía no existe.
  - Crea una `AsignacionDocente` vigente para el usuario autenticado si todavía no la tiene.

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
