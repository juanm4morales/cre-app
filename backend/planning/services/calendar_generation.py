from __future__ import annotations

from datetime import timedelta

from ..models import ClaseCalendario, DiaClasePrograma, Programa


def generate_calendar_classes_for_range(
    *,
    programa: Programa,
    fecha_desde,
    fecha_hasta,
    sobrescribir: bool = False,
):
    """Create class occurrences from weekly class-day rules within a date range.

    Returns a dict with created/skipped counters and created class ids.
    """
    dias_clase = list(
        programa.dias_clase.filter(activo=True).order_by("dia_semana", "id")
    )
    dias_por_semana = {}
    for dia in dias_clase:
        dias_por_semana.setdefault(dia.dia_semana, []).append(dia)

    if not dias_por_semana:
        return {
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "created_ids": [],
            "updated_ids": [],
        }

    existentes = {
        clase.fecha: clase
        for clase in ClaseCalendario.objects.filter(
            programa=programa,
            fecha__gte=fecha_desde,
            fecha__lte=fecha_hasta,
        )
    }

    current = fecha_desde
    created_ids = []
    updated_ids = []
    skipped = 0

    while current <= fecha_hasta:
        reglas_dia = dias_por_semana.get(current.weekday(), [])
        if reglas_dia:
            clase_existente = existentes.get(current)
            dia_clase_ref: DiaClasePrograma = reglas_dia[0]

            if clase_existente:
                if sobrescribir:
                    clase_existente.dia_clase = dia_clase_ref
                    clase_existente.save(update_fields=["dia_clase"])
                    updated_ids.append(clase_existente.id)
                else:
                    skipped += 1
            else:
                nueva = ClaseCalendario.objects.create(
                    programa=programa,
                    dia_clase=dia_clase_ref,
                    fecha=current,
                )
                created_ids.append(nueva.id)

        current += timedelta(days=1)

    return {
        "created": len(created_ids),
        "updated": len(updated_ids),
        "skipped": skipped,
        "created_ids": created_ids,
        "updated_ids": updated_ids,
    }
