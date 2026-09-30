from django.db import migrations


IP_TIPO_ACTIVIDAD_NAMES = [
    "Clase expositiva",
    "Clase expositivo-dialogada",
    "Clase teórico-práctica",
    "Clase de trabajo práctico",
    "Taller",
    "Seminario",
    "Clase de discusión o debate",
    "Estudio de casos",
    "Resolución de problemas",
    "Aprendizaje basado en problemas (ABP)",
    "Aprendizaje basado en proyectos",
    "Laboratorio",
    "Práctica de campo / salida de campo",
    "Simulación o juego de roles",
    "Demostración práctica",
    "Clínica o ateneo",
    "Tutoría grupal",
    "Tutoría individual",
    "Consultas académicas",
    "Coloquio",
    "Mesa redonda",
    "Panel con invitados",
    "Presentación de trabajos de estudiantes",
    "Exposición oral de estudiantes",
    "Socialización o puesta en común",
    "Revisión y retroalimentación de producciones",
    "Evaluación diagnóstica",
    "Evaluación formativa",
    "Evaluación parcial",
    "Recuperatorio",
    "Integración o síntesis de contenidos",
    "Clase de cierre",
    "Clase de repaso",
]


def seed_ip_tipo_actividad(apps, schema_editor):
    TipoActividad = apps.get_model("planning", "TipoActividad")

    for nombre in IP_TIPO_ACTIVIDAD_NAMES:
        TipoActividad.objects.get_or_create(
            nombre=nombre,
            defaults={"descripcion": "", "tipo_dedicacion": "IP"},
        )


def noop_reverse(apps, schema_editor):
    # Preserve catalog entries that may already be referenced by production data.
    pass


class Migration(migrations.Migration):
    dependencies = [("planning", "0010_alter_actividad_modalidad_trabajo")]

    operations = [migrations.RunPython(seed_ip_tipo_actividad, noop_reverse)]
