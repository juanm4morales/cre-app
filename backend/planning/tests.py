from datetime import date
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from openpyxl import Workbook

from academics.models import (
    Carrera,
    Competencia,
    EspacioCurricular,
    PlanEstudio,
    PlanEstudioEC,
    UnidadAcademica,
)
from .models import (
    ActividadAjuste,
    AsignacionDocente,
    ClaseCalendario,
    DiaClasePrograma,
    Programa,
    TipoActividad,
    Unidad,
    UnidadCompetencia,
)
from .serializers import ActividadCreateSerializer, DiaClaseProgramaSerializer
from .services.calendar_generation import generate_calendar_classes_for_range

User = get_user_model()


class AsignacionDocenteOverlapTestCase(TestCase):
    """Tests for temporal assignment overlap validation."""

    def setUp(self):
        """Create test data: user, academic unit, career, and course."""
        self.user = User.objects.create_user(
            username='docente1',
            password='test123'
        )
        
        self.unidad = UnidadAcademica.objects.create(
            nombre='Facultad de Ingeniería',
            sigla='FI'
        )
        
        self.carrera = Carrera.objects.create(
            nombre='Ingeniería en Sistemas',
            codigo='ISI',
            unidad_academica=self.unidad
        )
        
        self.espacio = EspacioCurricular.objects.create(
            nombre='Álgebra I',
            codigo='ALG1',
            tipo_espacio=EspacioCurricular.TipoEspacio.T1_ASIGNATURAS,
            anio_cursada=1,
            periodo=EspacioCurricular.Periodo.ANUAL,
            creditos=6,
            horas_ip=45,
            horas_ta=105
        )

    def test_no_overlap_sequential_assignments(self):
        """Test that sequential assignments (no overlap) are valid."""
        # Primera asignación: 2023-03-01 a 2023-12-15
        asig1 = AsignacionDocente.objects.create(
            docente=self.user,
            espacio_curricular=self.espacio,
            categoria=AsignacionDocente.Categoria.TITULAR,
            vigente_desde=date(2023, 3, 1),
            vigente_hasta=date(2023, 12, 15)
        )
        asig1.full_clean()  # Should not raise
        
        # Segunda asignación: 2025-03-01 a None (sin solapamiento)
        asig2 = AsignacionDocente(
            docente=self.user,
            espacio_curricular=self.espacio,
            categoria=AsignacionDocente.Categoria.ADJUNTO,
            vigente_desde=date(2025, 3, 1),
            vigente_hasta=None
        )
        asig2.full_clean()  # Should not raise
        asig2.save()
        
        self.assertEqual(AsignacionDocente.objects.count(), 2)

    def test_overlap_raises_validation_error(self):
        """Test that overlapping assignments raise ValidationError."""
        # Primera asignación: 2024-03-01 a 2024-12-15
        AsignacionDocente.objects.create(
            docente=self.user,
            espacio_curricular=self.espacio,
            categoria=AsignacionDocente.Categoria.TITULAR,
            vigente_desde=date(2024, 3, 1),
            vigente_hasta=date(2024, 12, 15)
        )
        
        # Segunda asignación solapada: 2024-06-01 a 2025-12-15
        asig2 = AsignacionDocente(
            docente=self.user,
            espacio_curricular=self.espacio,
            categoria=AsignacionDocente.Categoria.ADJUNTO,
            vigente_desde=date(2024, 6, 1),  # Se solapa!
            vigente_hasta=date(2025, 12, 15)
        )
        
        with self.assertRaises(ValidationError) as context:
            asig2.full_clean()
        
        self.assertIn('vigente_desde', context.exception.error_dict)

    def test_overlap_with_open_ended_assignment(self):
        """Test overlap detection when existing assignment has vigente_hasta=None."""
        # Asignación vigente actual (sin fecha fin)
        AsignacionDocente.objects.create(
            docente=self.user,
            espacio_curricular=self.espacio,
            categoria=AsignacionDocente.Categoria.TITULAR,
            vigente_desde=date(2024, 3, 1),
            vigente_hasta=None  # Vigente indefinidamente
        )
        
        # Intentar crear otra asignación en el futuro (se solapa!)
        asig2 = AsignacionDocente(
            docente=self.user,
            espacio_curricular=self.espacio,
            categoria=AsignacionDocente.Categoria.ADJUNTO,
            vigente_desde=date(2025, 3, 1),
            vigente_hasta=None
        )
        
        with self.assertRaises(ValidationError):
            asig2.full_clean()

    def test_different_courses_no_validation_error(self):
        """Test that same teacher can have overlapping assignments to different courses."""
        espacio2 = EspacioCurricular.objects.create(
            nombre='Cálculo I',
            codigo='CAL1',
            tipo_espacio=EspacioCurricular.TipoEspacio.T1_ASIGNATURAS,
            anio_cursada=1,
            periodo=EspacioCurricular.Periodo.ANUAL,
            creditos=6,
            horas_ip=45,
            horas_ta=105
        )
        
        # Asignación a ALG1
        AsignacionDocente.objects.create(
            docente=self.user,
            espacio_curricular=self.espacio,
            categoria=AsignacionDocente.Categoria.TITULAR,
            vigente_desde=date(2024, 3, 1),
            vigente_hasta=None
        )
        
        # Asignación a CAL1 (mismo periodo, diferente EC)
        asig2 = AsignacionDocente(
            docente=self.user,
            espacio_curricular=espacio2,
            categoria=AsignacionDocente.Categoria.ADJUNTO,
            vigente_desde=date(2024, 3, 1),
            vigente_hasta=None
        )
        asig2.full_clean()  # Should not raise
        asig2.save()
        
        self.assertEqual(AsignacionDocente.objects.count(), 2)

    def test_edit_assignment_without_creating_self_overlap(self):
        """Test that editing an assignment doesn't trigger self-overlap error."""
        asig = AsignacionDocente.objects.create(
            docente=self.user,
            espacio_curricular=self.espacio,
            categoria=AsignacionDocente.Categoria.TITULAR,
            vigente_desde=date(2024, 3, 1),
            vigente_hasta=date(2024, 12, 15)
        )
        
        # Editar la misma asignación (cambiar categoría)
        asig.categoria = AsignacionDocente.Categoria.ADJUNTO
        asig.full_clean()  # Should not raise (self-overlap excluded)
        asig.save()
        
        self.assertEqual(asig.categoria, AsignacionDocente.Categoria.ADJUNTO)

    def test_date_logic_validation_vigente_desde_after_vigente_hasta(self):
        """Test that vigente_desde cannot be after vigente_hasta."""
        asig = AsignacionDocente(
            docente=self.user,
            espacio_curricular=self.espacio,
            categoria=AsignacionDocente.Categoria.TITULAR,
            vigente_desde=date(2025, 12, 31),  # After vigente_hasta!
            vigente_hasta=date(2025, 1, 1)
        )
        
        with self.assertRaises(ValidationError) as context:
            asig.full_clean()
        
        # Should have error on vigente_hasta
        self.assertIn('vigente_hasta', context.exception.error_dict)
        error_msg = str(context.exception.error_dict['vigente_hasta'][0])
        self.assertIn('anterior', error_msg)  # "anterior" = before in Spanish

    def test_date_logic_validation_same_day_allowed(self):
        """Test that vigente_desde == vigente_hasta is allowed (single-day assignment)."""
        asig = AsignacionDocente(
            docente=self.user,
            espacio_curricular=self.espacio,
            categoria=AsignacionDocente.Categoria.TITULAR,
            vigente_desde=date(2025, 6, 15),
            vigente_hasta=date(2025, 6, 15)  # Same day - allowed
        )
        
        asig.full_clean()  # Should not raise
        asig.save()
        
        self.assertEqual(AsignacionDocente.objects.filter(pk=asig.pk).count(), 1)


class PlanningRulesTestCase(TestCase):
    """Tests for calendar/IP-TA rules and competencias constraints."""

    def setUp(self):
        self.user = User.objects.create_user(username="docente2", password="test123")

        self.unidad = UnidadAcademica.objects.create(nombre="FCE", sigla="FCE")
        self.carrera = Carrera.objects.create(
            nombre="Contador Publico",
            codigo="CP",
            unidad_academica=self.unidad,
        )
        self.espacio = EspacioCurricular.objects.create(
            nombre="Matematica",
            codigo="MAT1",
            tipo_espacio=EspacioCurricular.TipoEspacio.T1_ASIGNATURAS,
            anio_cursada=1,
            periodo=EspacioCurricular.Periodo.ANUAL,
            creditos=6,
            horas_ip=45,
            horas_ta=105,
        )

        self.plan = PlanEstudio.objects.create(
            carrera=self.carrera,
            nombre="Plan 2026",
            ordenanza="ORD-2026",
            creditos=300,
            vigente_desde=date(2026, 1, 1),
        )
        self.plan_ec = PlanEstudioEC.objects.create(
            plan_estudio=self.plan,
            espacio_curricular=self.espacio,
        )
        self.programa = Programa.objects.create(
            plan_estudio_ec=self.plan_ec,
            anio_academico=2026,
            descripcion="Programa anual",
        )
        self.unidad_prog = Unidad.objects.create(
            programa=self.programa,
            numero=1,
            descripcion="Unidad 1",
        )

        self.tipo_ip = TipoActividad.objects.create(
            nombre="Clase teorica",
            tipo_dedicacion=TipoActividad.TipoDedicacion.INTERACCION_PEDAGOGICA,
        )
        self.tipo_ta = TipoActividad.objects.create(
            nombre="Guia de trabajo",
            tipo_dedicacion=TipoActividad.TipoDedicacion.TRABAJO_AUTONOMO,
        )

        self.dia_lunes = DiaClasePrograma.objects.create(programa=self.programa, dia_semana=0)
        self.clase_lunes = ClaseCalendario.objects.create(
            programa=self.programa,
            dia_clase=self.dia_lunes,
            fecha=date(2026, 3, 2),
        )

    def test_unidad_competencia_requires_same_plan(self):
        competencia_ok = Competencia.objects.create(
            plan_estudio=self.plan,
            codigo="C1",
            nombre="Competencia base",
        )
        rel = UnidadCompetencia(
            unidad=self.unidad_prog,
            competencia=competencia_ok,
            orden=1,
        )
        rel.full_clean()

        otra_carrera = Carrera.objects.create(
            nombre="Licenciatura",
            codigo="LIC",
            unidad_academica=self.unidad,
        )
        otro_plan = PlanEstudio.objects.create(
            carrera=otra_carrera,
            nombre="Plan alterno",
            ordenanza="ORD-ALT",
            creditos=220,
            vigente_desde=date(2026, 1, 1),
        )
        competencia_otro_plan = Competencia.objects.create(
            plan_estudio=otro_plan,
            codigo="X1",
            nombre="Competencia externa",
        )
        with self.assertRaises(ValidationError):
            UnidadCompetencia.objects.create(
                unidad=self.unidad_prog,
                competencia=competencia_otro_plan,
                orden=2,
            )

    def test_serializer_requires_class_for_ip(self):
        serializer = ActividadCreateSerializer(
            data={
                "programa": self.programa.id,
                "tipo_actividad": self.tipo_ip.id,
                "descripcion": "Actividad IP",
                "horas": "2.00",
                "modalidad_trabajo": "IND",
                "unidad_ids": [self.unidad_prog.id],
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("clase_calendario", serializer.errors)

    def test_serializer_rejects_class_for_ta(self):
        serializer = ActividadCreateSerializer(
            data={
                "programa": self.programa.id,
                "tipo_actividad": self.tipo_ta.id,
                "descripcion": "Actividad TA",
                "horas": "1.50",
                "modalidad_trabajo": "IND",
                "unidad_ids": [self.unidad_prog.id],
                "clase_calendario": self.clase_lunes.id,
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("clase_calendario", serializer.errors)

    def test_extension_adjust_requires_positive_hours(self):
        actividad_serializer = ActividadCreateSerializer(
            data={
                "programa": self.programa.id,
                "tipo_actividad": self.tipo_ip.id,
                "descripcion": "Actividad base",
                "horas": "2.00",
                "modalidad_trabajo": "IND",
                "unidad_ids": [self.unidad_prog.id],
                "clase_calendario": self.clase_lunes.id,
            }
        )
        self.assertTrue(actividad_serializer.is_valid(), actividad_serializer.errors)
        actividad = actividad_serializer.save()

        with self.assertRaises(ValidationError):
            ActividadAjuste.objects.create(
                actividad=actividad,
                tipo=ActividadAjuste.Tipo.EXTENSION,
                motivo="Tiempo insuficiente",
                horas_ip_extra=0,
                creado_por=self.user,
            )

    def test_generate_calendar_classes_for_range_creates_without_duplicates(self):
        ClaseCalendario.objects.filter(id=self.clase_lunes.id).delete()

        result = generate_calendar_classes_for_range(
            programa=self.programa,
            fecha_desde=date(2026, 3, 1),
            fecha_hasta=date(2026, 3, 15),
            sobrescribir=False,
        )

        self.assertEqual(result["created"], 2)
        self.assertEqual(result["updated"], 0)
        self.assertEqual(result["skipped"], 0)

        fechas = set(
            ClaseCalendario.objects.filter(programa=self.programa).values_list("fecha", flat=True)
        )
        self.assertIn(date(2026, 3, 2), fechas)
        self.assertIn(date(2026, 3, 9), fechas)

        second_result = generate_calendar_classes_for_range(
            programa=self.programa,
            fecha_desde=date(2026, 3, 1),
            fecha_hasta=date(2026, 3, 15),
            sobrescribir=False,
        )
        self.assertEqual(second_result["created"], 0)
        self.assertEqual(second_result["skipped"], 2)

    def test_generate_calendar_classes_for_range_overwrites_dia_clase(self):
        dia_martes = DiaClasePrograma.objects.create(programa=self.programa, dia_semana=1)
        clase = self.clase_lunes
        clase.dia_clase = dia_martes
        clase.save(update_fields=["dia_clase"])

        result = generate_calendar_classes_for_range(
            programa=self.programa,
            fecha_desde=date(2026, 3, 1),
            fecha_hasta=date(2026, 3, 2),
            sobrescribir=True,
        )

        clase.refresh_from_db()
        self.assertEqual(result["updated"], 1)
        self.assertEqual(clase.dia_clase_id, self.dia_lunes.id)

    def test_dia_clase_serializer_rejects_fin_before_inicio(self):
        serializer = DiaClaseProgramaSerializer(
            data={
                "programa": self.programa.id,
                "dia_semana": 0,
                "hora_inicio": "13:30",
                "hora_fin": "04:00",
                "activo": True,
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("hora_fin", serializer.errors)

    def test_dia_clase_serializer_rejects_incomplete_time_range(self):
        serializer = DiaClaseProgramaSerializer(
            data={
                "programa": self.programa.id,
                "dia_semana": 0,
                "hora_inicio": "13:30",
                "hora_fin": None,
                "activo": True,
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("hora_fin", serializer.errors)


class ImportTipoActividadXlsxCommandTests(TestCase):
    def _build_tipificaciones_workbook(self, file_path: Path) -> None:
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Sheet1"
        sheet["A1"] = "Tipo de actividad"
        sheet["A2"] = "Tipo de actividad"
        sheet["B2"] = "Descripción"
        sheet["C2"] = "Ejemplos"
        sheet["D2"] = "modalidad de trabajo"
        sheet["F2"] = "Consideraciones"
        sheet.merge_cells("D2:E2")

        sheet["A3"] = "Lectura y comprensión de bibliografía"
        sheet["B3"] = "Lectura de materiales"
        sheet["C3"] = "Guías de lectura"
        sheet["D3"] = "Individual"
        sheet["E3"] = "Grupal"
        sheet["F3"] = "Depende de la complejidad del texto"

        sheet["A4"] = "Resolución de trabajos prácticos individuales"
        sheet["B4"] = "Actividades individuales"
        sheet["C4"] = "Estudios de caso"
        sheet["F4"] = "Demanda tiempo de resolución"
        sheet.merge_cells("D4:E5")

        sheet["A5"] = "Resolución de trabajos prácticos grupales"
        sheet["B5"] = "Actividades colaborativas"
        sheet["C5"] = "Proyectos grupales"
        sheet["F5"] = "Requiere coordinación"

        sheet["A6"] = "Otros"
        sheet["B6"] = "Describir"

        workbook.save(file_path)

    def test_import_tipo_actividad_xlsx_creates_and_updates_tipificaciones(self):
        with TemporaryDirectory() as temp_dir:
            workbook_path = Path(temp_dir) / "tipificaciones.xlsx"
            self._build_tipificaciones_workbook(workbook_path)

            output = StringIO()
            call_command(
                "import_tipo_actividad_xlsx",
                str(workbook_path),
                stdout=output,
            )
            call_command(
                "import_tipo_actividad_xlsx",
                str(workbook_path),
                stdout=StringIO(),
            )

        self.assertEqual(TipoActividad.objects.count(), 4)

        lectura = TipoActividad.objects.get(nombre="Lectura y comprensión de bibliografía")
        self.assertEqual(lectura.tipo_dedicacion, TipoActividad.TipoDedicacion.TRABAJO_AUTONOMO)
        self.assertIsNone(lectura.modalidad_trabajo)
        self.assertIn("Ejemplos:", lectura.descripcion)
        self.assertIn("Consideraciones:", lectura.descripcion)

        individual = TipoActividad.objects.get(nombre="Resolución de trabajos prácticos individuales")
        self.assertEqual(individual.modalidad_trabajo, TipoActividad.ModalidadTrabajo.INDIVIDUAL)

        grupal = TipoActividad.objects.get(nombre="Resolución de trabajos prácticos grupales")
        self.assertEqual(grupal.modalidad_trabajo, TipoActividad.ModalidadTrabajo.GRUPO)

        otros = TipoActividad.objects.get(nombre="Otros")
        self.assertEqual(otros.tipo_dedicacion, TipoActividad.TipoDedicacion.TRABAJO_AUTONOMO)
        self.assertIn("tipo_actividad", output.getvalue())

    def test_import_tipo_actividad_xlsx_dry_run_rolls_back(self):
        with TemporaryDirectory() as temp_dir:
            workbook_path = Path(temp_dir) / "tipificaciones.xlsx"
            self._build_tipificaciones_workbook(workbook_path)

            call_command(
                "import_tipo_actividad_xlsx",
                str(workbook_path),
                "--dry-run",
            )

        self.assertEqual(TipoActividad.objects.count(), 0)

