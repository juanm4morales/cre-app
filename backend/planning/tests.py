from datetime import date
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
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
    Actividad,
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
        self.assertIn("Ejemplos:", lectura.descripcion)
        self.assertIn("Consideraciones:", lectura.descripcion)

        individual = TipoActividad.objects.get(nombre="Resolución de trabajos prácticos individuales")
        self.assertEqual(individual.tipo_dedicacion, TipoActividad.TipoDedicacion.TRABAJO_AUTONOMO)

        grupal = TipoActividad.objects.get(nombre="Resolución de trabajos prácticos grupales")
        self.assertEqual(grupal.tipo_dedicacion, TipoActividad.TipoDedicacion.TRABAJO_AUTONOMO)

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


# ═══════════════════════════════════════════════════════════════════
#  INTEGRATION TESTS — Full flow docente + admin, scoping, CRUD
# ═══════════════════════════════════════════════════════════════════

class PlanningFullFlowIntegrationTest(TestCase):
    """
    Full API integration flow for a docente:
    espacios → create_programa → unidades → dias-clase → calendario → actividades
    Plus admin access, scoping, soft-delete cascade, competencias, ajustes.
    """

    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.today = timezone.now().date()
        self.current_year = self.today.year

        # === Users ===
        self.admin_user = get_user_model().objects.create_user(
            username="admin_plan",
            password="AdminPass1!",
            is_staff=True,
        )
        self.admin_user.profile.role = "ADMIN"
        self.admin_user.profile.save()

        self.docente = get_user_model().objects.create_user(
            username="docente_plan",
            password="DocentePass1!",
            first_name="Docente",
            last_name="Plan",
        )

        # === Academic structure ===
        self.unidad = UnidadAcademica.objects.create(
            nombre="Facultad Test", sigla="FT"
        )
        self.carrera = Carrera.objects.create(
            nombre="Ingeniería QA",
            codigo="IQA",
            nivel=Carrera.DegreeLevel.GRADO,
            unidad_academica=self.unidad,
        )
        self.plan = PlanEstudio.objects.create(
            carrera=self.carrera,
            nombre="Plan QA 2026",
            ordenanza="ORD-QA",
            creditos=200,
            vigente_desde=date(2026, 1, 1),
        )
        self.espacio = EspacioCurricular.objects.create(
            nombre="Matematica QA",
            codigo="MATQA",
            tipo_espacio=EspacioCurricular.TipoEspacio.T1_ASIGNATURAS,
            anio_cursada=1,
            periodo=EspacioCurricular.Periodo.ANUAL,
            creditos=6,
            horas_ip=45,
            horas_ta=105,
        )
        self.plan_ec = PlanEstudioEC.objects.create(
            plan_estudio=self.plan,
            espacio_curricular=self.espacio,
        )

        # === A second EC (for scoping tests) ===
        self.otro_espacio = EspacioCurricular.objects.create(
            nombre="Fisica QA",
            codigo="FISQA",
            tipo_espacio=EspacioCurricular.TipoEspacio.T1_ASIGNATURAS,
            anio_cursada=1,
            periodo=EspacioCurricular.Periodo.ANUAL,
            creditos=6,
            horas_ip=45,
            horas_ta=105,
        )
        self.otro_plan = PlanEstudio.objects.create(
            carrera=self.carrera,
            nombre="Plan FIS QA",
            ordenanza="ORD-FIS",
            creditos=180,
            vigente_desde=date(2026, 1, 1),
        )
        self.otro_plan_ec = PlanEstudioEC.objects.create(
            plan_estudio=self.otro_plan,
            espacio_curricular=self.otro_espacio,
        )

        # === AsignacionDocente (active now) ===
        self.asignacion = AsignacionDocente.objects.create(
            docente=self.docente,
            espacio_curricular=self.espacio,
            categoria=AsignacionDocente.Categoria.TITULAR,
            vigente_desde=self.today - timezone.timedelta(days=30),
            vigente_hasta=self.today + timezone.timedelta(days=300),
        )

        # === TipoActividad ===
        self.tipo_ip = TipoActividad.objects.create(
            nombre="Clase teorica QA",
            tipo_dedicacion=TipoActividad.TipoDedicacion.INTERACCION_PEDAGOGICA,
        )
        self.tipo_ta = TipoActividad.objects.create(
            nombre="TP QA",
            tipo_dedicacion=TipoActividad.TipoDedicacion.TRABAJO_AUTONOMO,
        )

        # === Competencias ===
        self.competencia = Competencia.objects.create(
            plan_estudio=self.plan,
            codigo="C-QA-01",
            nombre="Competencia QA 1",
        )

    # ── helpers ──

    def _login(self, username: str, password: str):
        csrf_resp = self.client.get("/api/auth/csrf")
        token = csrf_resp.cookies["csrftoken"].value
        self.client.post(
            "/api/auth/login",
            {"username": username, "password": password},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

    def _csrf(self) -> str:
        resp = self.client.get("/api/auth/csrf")
        return resp.cookies["csrftoken"].value

    # ── Tests ──

    # ──────── 1. Docente full CRUD flow ────────

    def test_01_docente_full_flow_create_program_unidades_actividades(self):
        """Docente full flow: espacios → create programa → unidades → actividades"""
        self._login("docente_plan", "DocentePass1!")

        # 1a. GET /api/espacios-asignados → assigned ECs
        resp = self.client.get("/api/espacios-asignados")
        self.assertEqual(resp.status_code, 200)
        ec_names = [ec["nombre"] for ec in resp.json()]
        self.assertIn("Matematica QA", ec_names)
        self.assertNotIn("Fisica QA", ec_names)

        # 1b. POST create_programa_if_needed
        token = self._csrf()
        resp = self.client.post(
            "/api/espacios-asignados/create_programa_if_needed",
            {"plan_estudio_ec_id": self.plan_ec.id},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertIn(resp.status_code, (200, 201), resp.json())
        programa_id = resp.json()["id"]

        # 1c. GET /api/programas → verify scoped by plan_ec
        resp = self.client.get(f"/api/programas?plan_estudio_ec_id={self.plan_ec.id}")
        self.assertEqual(resp.status_code, 200)
        programa_ids = [p["id"] for p in resp.json()["results"]]
        self.assertIn(programa_id, programa_ids)

        # 1d. POST /api/unidades → create 2 units
        token = self._csrf()
        resp = self.client.post(
            "/api/unidades",
            {
                "programa": programa_id,
                "numero": 1,
                "descripcion": "Unidad 1 - Introduccion",
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        unity_resp = resp.json()
        self.assertEqual(resp.status_code, 201, f"Unidad 1 create failed: {unity_resp}")
        unidad_1_id = unity_resp["id"]

        token = self._csrf()
        resp = self.client.post(
            "/api/unidades",
            {
                "programa": programa_id,
                "numero": 2,
                "descripcion": "Unidad 2 - Desarrollo",
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        unity_resp = resp.json()
        self.assertEqual(resp.status_code, 201, f"Unidad 2 create failed: {unity_resp}")
        unidad_2_id = unity_resp["id"]

        # 1e. POST /api/dias-clase → 2 weekly class blocks
        token = self._csrf()
        resp = self.client.post(
            "/api/dias-clase",
            {
                "programa": programa_id,
                "dia_semana": 0,  # Monday
                "hora_inicio": "08:00",
                "hora_fin": "10:00",
                "activo": True,
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 201, resp.json())

        token = self._csrf()
        resp = self.client.post(
            "/api/dias-clase",
            {
                "programa": programa_id,
                "dia_semana": 2,  # Wednesday
                "hora_inicio": "08:00",
                "hora_fin": "10:00",
                "activo": True,
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 201, resp.json())

        # 1f. POST /api/clases-calendario/generar-rango
        token = self._csrf()
        # Find a Monday in the current year
        march_monday = date(self.current_year, 3, 2)
        if march_monday.weekday() != 0:
            march_monday = date(self.current_year, 3, 1)
            while march_monday.weekday() != 0:
                march_monday += timezone.timedelta(days=1)

        resp = self.client.post(
            "/api/clases-calendario/generar-rango",
            {
                "programa_id": programa_id,
                "fecha_desde": march_monday.isoformat(),
                "fecha_hasta": (march_monday + timezone.timedelta(days=14)).isoformat(),
                "sobrescribir": False,
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 200, resp.json())
        # 2 weeks × 2 days/week = 4 classes (but some may be outside range)
        self.assertGreaterEqual(resp.json()["created"], 2)

        # Get a created class for IP actividad
        clase = ClaseCalendario.objects.filter(programa_id=programa_id).first()
        self.assertIsNotNone(clase)

        # 1g. POST /api/actividades → create IP actividad (con clase)
        token = self._csrf()
        resp = self.client.post(
            "/api/actividades",
            {
                "programa": programa_id,
                "tipo_actividad": self.tipo_ip.id,
                "descripcion": "Clase teorica - Semana 1",
                "horas": "2.00",
                "modalidad_trabajo": "IND",
                "unidad_ids": [unidad_1_id, unidad_2_id],
                "clase_calendario": clase.id,
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 201, resp.json())
        actividad_ip_id = resp.json()["id"]

        # 1h. POST /api/actividades → create TA actividad (sin clase)
        token = self._csrf()
        resp = self.client.post(
            "/api/actividades",
            {
                "programa": programa_id,
                "tipo_actividad": self.tipo_ta.id,
                "descripcion": "TP - Resolver ejercicios",
                "horas": "3.00",
                "modalidad_trabajo": "IND",
                "unidad_ids": [unidad_1_id],
                "fecha_inicio_ta": march_monday.isoformat(),
                "fecha_fin_ta": (march_monday + timezone.timedelta(days=7)).isoformat(),
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 201, resp.json())
        actividad_ta_id = resp.json()["id"]

        # 1i. GET /api/actividades → verify both exist and scoped
        resp = self.client.get(f"/api/actividades?programa_id={programa_id}")
        self.assertEqual(resp.status_code, 200)
        activity_ids = [a["id"] for a in resp.json()["results"]]
        self.assertIn(actividad_ip_id, activity_ids)
        self.assertIn(actividad_ta_id, activity_ids)

        return programa_id, unidad_1_id, actividad_ip_id

    # ──────── 2. Soft-delete cascade ────────

    def test_02_soft_delete_programa_cascades_to_unidades_actividades(self):
        """DELETE /api/programas/{id} sets activo=False on programa, unidades, actividades."""
        programa_id, _, _ = self.test_01_docente_full_flow_create_program_unidades_actividades()

        self._login("admin_plan", "AdminPass1!")
        token = self._csrf()

        resp = self.client.delete(
            f"/api/programas/{programa_id}",
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 204)

        # Verify cascade
        programa = Programa.objects.get(id=programa_id)
        self.assertFalse(programa.activo)
        self.assertFalse(
            Unidad.objects.filter(programa_id=programa_id, activo=True).exists()
        )
        self.assertFalse(
            Actividad.objects.filter(programa_id=programa_id, activo=True).exists()
        )

    # ──────── 3. Scoping: docente cannot access otra EC ────────

    def test_03_docente_scoping_blocks_other_ec(self):
        """Docente cannot create program for unassigned EC."""
        self._login("docente_plan", "DocentePass1!")
        token = self._csrf()

        # Try create_programa_if_needed for the OTHER space (not assigned)
        resp = self.client.post(
            "/api/espacios-asignados/create_programa_if_needed",
            {"plan_estudio_ec_id": self.otro_plan_ec.id},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 403, resp.json())

    def test_04_docente_cannot_see_other_ec_programs(self):
        """Docente's GET /api/programas excludes otro EC's programs."""
        # Admin creates a program for otro_espacio
        self._login("admin_plan", "AdminPass1!")
        token = self._csrf()
        resp = self.client.post(
            "/api/programas",
            {
                "plan_estudio_ec": self.otro_plan_ec.id,
                "anio_academico": self.current_year,
                "descripcion": "Programa Fisica",
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 201, resp.json())
        otro_programa_id = resp.json()["id"]

        # Now login as docente
        self._login("docente_plan", "DocentePass1!")
        resp = self.client.get("/api/programas")
        self.assertEqual(resp.status_code, 200)
        programa_ids = [p["id"] for p in resp.json()["results"]]
        self.assertNotIn(otro_programa_id, programa_ids)

    # ──────── 4. Admin access ────────

    def test_05_admin_sees_all_espacios_asignados(self):
        """Admin GET /api/espacios-asignados returns ALL ECs, not just assigned."""
        self._login("admin_plan", "AdminPass1!")
        resp = self.client.get("/api/espacios-asignados")
        self.assertEqual(resp.status_code, 200)
        ec_names = [ec["nombre"] for ec in resp.json()]
        self.assertIn("Matematica QA", ec_names)
        self.assertIn("Fisica QA", ec_names)

    # ──────── 5. TipoActividad endpoint (permissions) ────────

    def test_06_tipo_actividad_read_allowed_authenticated(self):
        """Authenticated user can GET /api/tipos-actividad."""
        self._login("docente_plan", "DocentePass1!")
        resp = self.client.get("/api/tipos-actividad")
        self.assertEqual(resp.status_code, 200)
        names = [t["nombre"] for t in resp.json()["results"]]
        self.assertIn("Clase teorica QA", names)

    def test_07_tipo_actividad_create_requires_admin(self):
        """Docente cannot POST /api/tipos-actividad."""
        self._login("docente_plan", "DocentePass1!")
        token = self._csrf()
        resp = self.client.post(
            "/api/tipos-actividad",
            {"nombre": "Hack", "tipo_dedicacion": "IP"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 403)

    # ──────── 6. Competencia assignment via API ────────

    def test_08_assign_competencias_to_unidad(self):
        """POST /api/unidades/{id}/competencias assigns competencias."""
        programa_id, unidad_1_id, _ = self.test_01_docente_full_flow_create_program_unidades_actividades()

        self._login("admin_plan", "AdminPass1!")
        token = self._csrf()
        resp = self.client.post(
            f"/api/unidades/{unidad_1_id}/competencias",
            {"competencia_ids": [self.competencia.id]},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 200, resp.json())

        # Verify
        unidad = Unidad.objects.get(id=unidad_1_id)
        self.assertTrue(unidad.competencias_rel.filter(competencia_id=self.competencia.id).exists())

    # ──────── 7. Actividad ajustes ────────

    def test_09_create_activity_adjustment(self):
        """POST /api/actividades/{id}/ajustes creates EXTENSION."""
        programa_id, _, actividad_ip_id = self.test_01_docente_full_flow_create_program_unidades_actividades()

        self._login("admin_plan", "AdminPass1!")

        # Get a calendar class from the same program for destino_clase
        clase_destino = ClaseCalendario.objects.filter(programa_id=programa_id).first()
        self.assertIsNotNone(clase_destino)

        token = self._csrf()
        resp = self.client.post(
            f"/api/actividades/{actividad_ip_id}/ajustes",
            {
                "tipo": "EXT",
                "motivo": "Tiempo insuficiente para cubrir el tema",
                "horas_ip_extra": "1.00",
                "clase_destino": clase_destino.id,
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 201, resp.json())

        # Verify
        ajustes_resp = self.client.get(f"/api/actividades/{actividad_ip_id}/ajustes")
        self.assertEqual(ajustes_resp.status_code, 200)
        self.assertEqual(len(ajustes_resp.json()), 1)

    # ──────── 8. Scoping: docente cannot delete otra EC's records ────────

    def test_10_docente_cannot_delete_other_ec_program(self):
        """Docente DELETE on another EC's program returns 404 (scoped)."""
        # Admin creates a program for otro_espacio
        self._login("admin_plan", "AdminPass1!")
        token = self._csrf()
        resp = self.client.post(
            "/api/programas",
            {
                "plan_estudio_ec": self.otro_plan_ec.id,
                "anio_academico": self.current_year,
                "descripcion": "Programa Fisica",
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(resp.status_code, 201)
        otro_programa_id = resp.json()["id"]

        # Docente tries to delete it
        self._login("docente_plan", "DocentePass1!")
        token = self._csrf()
        resp = self.client.delete(
            f"/api/programas/{otro_programa_id}",
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        # 404 because scoped query excludes it → get_object raises Http404
        self.assertEqual(resp.status_code, 404)
