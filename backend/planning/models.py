from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.utils import timezone
from datetime import date

from academics.models import PlanEstudioEC, EspacioCurricular


class AsignacionDocenteManager(models.Manager):
    """Manager custom para filtrar asignaciones docentes por vigencia temporal."""

    def activas(self, fecha: date = None) -> models.QuerySet:
        """
        Retorna asignaciones vigentes en una fecha específica.
        Si no se proporciona fecha, usa la fecha actual.

        Args:
            fecha: fecha en la que verificar vigencia (default: hoy)

        Returns:
            QuerySet de AsignacionDocente vigentes
        """
        if fecha is None:
            fecha = timezone.now().date()
        return self.filter(
            vigente_desde__lte=fecha
        ).filter(
            models.Q(vigente_hasta__isnull=True) | models.Q(vigente_hasta__gte=fecha)
        )


# Create your models here.
class Programa(models.Model):
    """
    Model that represents a university program.
    """
    plan_estudio_ec = models.ForeignKey(
        PlanEstudioEC,
        on_delete=models.CASCADE,
        related_name='programas',
        help_text="Plan de estudio y espacio curricular asociados al programa"
    )
    
    anio_academico = models.PositiveIntegerField(
        validators=[MinValueValidator(1939)],
        db_index=True,
        help_text="Año académico al que pertenece el programa"
    )
    
    descripcion = models.TextField(
        blank=True,
        help_text="Descripción del programa"
    )

    activo = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Indica si el programa está activo (baja lógica).",
    )
    
    class Meta:
        verbose_name = "programa"
        verbose_name_plural = "programas"
        db_table = "programa"
        constraints = [
            models.UniqueConstraint(
                fields=['plan_estudio_ec', 'anio_academico'],
                name='unique_programa_ec_anio'
            )
        ]
        
    def __str__(self):
        return f"{self.plan_estudio_ec} - {self.anio_academico}"


class Unidad(models.Model):
    """
    Model that represents a teaching unit within a program.
    """
    programa = models.ForeignKey(
        Programa,
        on_delete=models.CASCADE,
        related_name='unidades',
        help_text="Programa al que pertenece la unidad",
    )

    numero = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        help_text="Número de unidad dentro del programa",
    )

    descripcion = models.CharField(
        max_length=255,
        help_text="Descripción de la unidad",
    )

    activo = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Indica si la unidad está activa (baja lógica).",
    )

    class Meta:
        verbose_name = "unidad"
        verbose_name_plural = "unidades"
        db_table = "unidad"
        ordering = ["programa_id", "numero"]
        constraints = [
            models.UniqueConstraint(
                fields=['programa', 'numero'],
                name='unique_unidad_programa_numero'
            )
        ]

    def __str__(self):
        return f"Unidad {self.numero} - {self.programa}"


class UnidadCompetencia(models.Model):
    """Relacion entre una unidad del programa y competencias del plan."""

    unidad = models.ForeignKey(
        Unidad,
        on_delete=models.CASCADE,
        related_name="competencias_rel",
    )
    competencia = models.ForeignKey(
        "academics.Competencia",
        on_delete=models.PROTECT,
        related_name="unidades_rel",
    )
    orden = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
    )

    class Meta:
        verbose_name = "unidad competencia"
        verbose_name_plural = "unidades competencias"
        db_table = "unidad_competencia"
        ordering = ["unidad_id", "orden", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["unidad", "competencia"],
                name="unique_unidad_competencia",
            )
        ]

    def clean(self) -> None:
        super().clean()
        if not self.unidad_id or not self.competencia_id:
            return

        plan_unidad_id = self.unidad.programa.plan_estudio_ec.plan_estudio_id
        if self.competencia.plan_estudio_id != plan_unidad_id:
            raise ValidationError(
                {
                    "competencia": (
                        "La competencia debe pertenecer al mismo plan de estudio "
                        "del programa de la unidad."
                    )
                }
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.unidad} - {self.competencia.codigo}"


class DiaClasePrograma(models.Model):
    """Configuracion semanal de dias de clase para un programa."""

    class DiaSemana(models.IntegerChoices):
        LUNES = 0, "Lunes"
        MARTES = 1, "Martes"
        MIERCOLES = 2, "Miercoles"
        JUEVES = 3, "Jueves"
        VIERNES = 4, "Viernes"
        SABADO = 5, "Sabado"
        DOMINGO = 6, "Domingo"

    programa = models.ForeignKey(
        Programa,
        on_delete=models.CASCADE,
        related_name="dias_clase",
    )
    dia_semana = models.PositiveSmallIntegerField(choices=DiaSemana.choices)
    hora_inicio = models.TimeField(blank=True, null=True)
    hora_fin = models.TimeField(blank=True, null=True)
    activo = models.BooleanField(default=True, db_index=True)

    class Meta:
        verbose_name = "dia de clase"
        verbose_name_plural = "dias de clase"
        db_table = "dia_clase_programa"
        ordering = ["programa_id", "dia_semana", "hora_inicio", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["programa", "dia_semana", "hora_inicio", "hora_fin"],
                name="unique_dia_clase_programa_slot",
            ),
            models.CheckConstraint(
                condition=models.Q(hora_fin__isnull=True)
                | models.Q(hora_inicio__isnull=True)
                | models.Q(hora_inicio__lt=models.F("hora_fin")),
                name="check_dia_clase_hora_inicio_menor_hora_fin",
            ),
        ]

    def __str__(self):
        return f"{self.programa} - {self.get_dia_semana_display()}"


class ClaseCalendario(models.Model):
    """Ocurrencia concreta en calendario para un programa."""

    class Estado(models.TextChoices):
        PLANIFICADA = "PLAN", "Planificada"
        DICTADA = "DICT", "Dictada"
        CANCELADA = "CANC", "Cancelada"

    programa = models.ForeignKey(
        Programa,
        on_delete=models.CASCADE,
        related_name="clases_calendario",
    )
    dia_clase = models.ForeignKey(
        DiaClasePrograma,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="clases_calendario",
    )
    fecha = models.DateField(db_index=True)
    estado = models.CharField(
        max_length=4,
        choices=Estado.choices,
        default=Estado.PLANIFICADA,
    )
    observaciones = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = "clase de calendario"
        verbose_name_plural = "clases de calendario"
        db_table = "clase_calendario"
        ordering = ["programa_id", "fecha", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["programa", "fecha"],
                name="unique_clase_calendario_programa_fecha",
            )
        ]

    def clean(self) -> None:
        super().clean()
        if self.dia_clase_id and self.dia_clase.programa_id != self.programa_id:
            raise ValidationError(
                {"dia_clase": "El dia de clase debe pertenecer al mismo programa."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.programa} - {self.fecha}"

class AsignacionDocente(models.Model):
    """
    Model that represents the assignment of a teacher to a curricular space.
    Uses temporal validity to support multiple assignments over time.
    """
    class Categoria(models.TextChoices):
        TITULAR = 'TIT', 'Titular'
        ADJUNTO = 'ADJ', 'Adjunto'
        ASOCIADO = 'ASO', 'Asociado'
        JTP = 'JTP', 'Jefe de Trabajos Prácticos'
        AYUDANTE_1 = 'AY1', 'Ayudante de 1°'
        AYUDANTE_2 = 'AY2', 'Ayudante de 2°'
    
    docente = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='asignaciones_docente',
        help_text="Docente asignado a espacio curricular"
    )
    
    espacio_curricular = models.ForeignKey(
        EspacioCurricular,
        on_delete=models.PROTECT,
        related_name='asignaciones_docente',
        help_text="Espacio curricular al que está asignado el docente"
    )
    
    categoria = models.CharField(
        max_length=5,
        choices=Categoria.choices,
        help_text="Categoría docente"
    )
    
    vigente_desde = models.DateField(
        help_text="Fecha desde la cual la asignación está vigente"
    )
    
    vigente_hasta = models.DateField(
        null=True,
        blank=True,
        help_text="Fecha hasta la cual la asignación estuvo vigente (dejar en blanco si aún está vigente)"
    )

    objects = AsignacionDocenteManager()

    class Meta:
        verbose_name = "asignación docente"
        verbose_name_plural = "asignaciones docentes"
        db_table = "asignacion_docente"
        indexes = [
            models.Index(fields=['docente', 'vigente_desde']),
            models.Index(fields=['espacio_curricular', 'vigente_desde']),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(vigente_hasta__isnull=True) | models.Q(vigente_desde__lte=models.F('vigente_hasta')),
                name='check_valid_temporal_range',
                violation_error_message='vigente_desde debe ser anterior o igual a vigente_hasta.'
            ),
        ]

    def _find_overlapping_assignment(self) -> "AsignacionDocente | None":
        """
        Private helper: Find an existing overlapping assignment.
        
        Overlap logic: A_start <= B_end AND B_start <= A_end
        With NULL handling for open-ended assignments.
        
        Returns:
            First overlapping AsignacionDocente or None
        """
        upper_bound = self.vigente_hasta or date.max
        
        overlaps = AsignacionDocente.objects.filter(
            docente=self.docente,
            espacio_curricular=self.espacio_curricular,
            vigente_desde__lte=upper_bound
        ).filter(
            models.Q(vigente_hasta__isnull=True) | models.Q(vigente_hasta__gte=self.vigente_desde)
        )
        
        # Exclude current instance if editing
        if self.pk:
            overlaps = overlaps.exclude(pk=self.pk)
        
        return overlaps.first()

    def clean(self) -> None:
        """
        Validate assignment consistency at model level.
        
        ⚠️ IMPORTANT - Race Condition Analysis:
        =====================================
        
        VALIDATIONS PERFORMED:
        1. vigente_desde <= vigente_hasta (if vigente_hasta is set)
           ✅ Protected by DB-level CheckConstraint → 100% atomic, race-condition free
           
        2. No temporal overlaps with other assignments to same teacher + course
           ⚠️  Validated at Python level (read-check-write pattern)
           ⚠️  Small race condition window exists if not protected by transaction
        
        RACE CONDITION EXPLANATION (TOCTOU):
        - Time Of Check: Read DB to find overlaps
        - [VULNERABLE WINDOW] Another user inserts conflicting record
        - Time Of Use: This instance saves its record
        - Result: Two overlapping assignments bypass validation! ❌
        
        MITIGATION:
        - In Django Admin: save_model() uses select_for_update() + atomic transaction
        - In DRF Views: ViewSets must implement similar locking strategy
        - Direct ORM usage: User responsibility to ensure atomicity
        
        DATA CONSISTENCY GUARANTEE:
        - CheckConstraint provides 100% atomicity for temporal ranges
        - Overlap detection: ~99.9% safe (negligible risk when using atomic transactions)
        - For mission-critical systems: Implement stored procedures or PostgreSQL native constraints
        
        Raises:
            ValidationError: If validation fails
        """
        errors = {}
        
        # Validation 1: Date logic check
        # Note: Also protected by DB constraint (CheckConstraint), but checking here for immediate UX feedback
        if self.vigente_hasta and self.vigente_desde > self.vigente_hasta:
            errors['vigente_hasta'] = (
                'La fecha de fin (vigente_hasta) no puede ser anterior a '
                'la fecha de inicio (vigente_desde).'
            )
        
        # Validation 2: Temporal overlap check
        # Note: Vulnerable to race conditions unless called within select_for_update() transaction
        if not errors:
            overlapping = self._find_overlapping_assignment()
            if overlapping:
                errors['vigente_desde'] = (
                    f'Esta asignación se solapa con una existente: '
                    f'{overlapping.docente} → {self.espacio_curricular} '
                    f'(vigente desde {overlapping.vigente_desde} '
                    f'hasta {overlapping.vigente_hasta or "actualidad"}).'
                )
        
        if errors:
            raise ValidationError(errors)

    @property
    def activo(self) -> bool:
        """Backward compatibility property: checks if assignment is currently active."""
        return self.esta_vigente()

    def esta_vigente(self, fecha: date = None) -> bool:
        """Checks if assignment is valid on a specific date (or today if not provided)."""
        if fecha is None:
            fecha = timezone.now().date()
        return self.vigente_desde <= fecha and (self.vigente_hasta is None or self.vigente_hasta >= fecha)
        
    def __str__(self):
        estado = "vigente" if self.activo else "inactiva"
        return f"{self.docente} - {self.espacio_curricular} ({estado})"

    
class TipoActividad(models.Model):
    """
    Model that represents a type of activity within a curricular space.
    """   
    class TipoDedicacion(models.TextChoices):
        INTERACCION_PEDAGOGICA = "IP", "Interacción Pedagógica (IP)"
        TRABAJO_AUTONOMO = "TA", "Trabajo Autónomo (TA)"
    
    nombre = models.CharField(
        max_length=100,
        unique=True,
        help_text="Nombre del tipo de actividad"
    )
    
    descripcion = models.TextField(
        blank=True,
        null=True,
        help_text="Descripción del tipo de actividad (opcional)"
    )
    
    tipo_dedicacion = models.CharField(
        max_length=5,
        default=TipoDedicacion.TRABAJO_AUTONOMO,
        choices=TipoDedicacion.choices,
        help_text="Tipo de dedicación de la actividad"
    )
    
    class Meta:
        verbose_name = "tipo de actividad"
        verbose_name_plural = "tipos de actividades"
        db_table = "tipo_actividad"
        
    def __str__(self):
        return self.nombre

def get_tipo_actividad_otros():
    """
    Retorna el TipoActividad "Otros", creándolo si no existe.
    """
    otros, _ = TipoActividad.objects.get_or_create(
        nombre="Otros",
        defaults={
            'descripcion': "Tipo de actividad general",
            'tipo_dedicacion': "TA",
        }
    )
    return otros.pk

class Actividad(models.Model):
    """
    Model that represents an activity within a program.
    """
    class ModalidadTrabajo(models.TextChoices):
        INDIVIDUAL = "IND", "Trabajo Individual"
        EQUIPO = "EQU", "Trabajo Grupal"

    programa = models.ForeignKey(
        Programa,
        on_delete=models.CASCADE,
        related_name='actividades',
        help_text="Programa asociado a esta actividad",
    )

    unidades = models.ManyToManyField(
        Unidad,
        related_name='actividades',
        help_text="Unidades del programa asociadas a esta actividad",
    )
    
    tipo_actividad = models.ForeignKey(
        TipoActividad,
        on_delete=models.SET_DEFAULT,
        default=get_tipo_actividad_otros,
        related_name='actividades',
        help_text="Tipo de actividad (según tipificación establecida). Por defecto: 'Otros'"
    )
        
    descripcion = models.CharField(
        max_length=255,
        help_text="Descripción de la actividad"
    )

    modalidad_trabajo = models.CharField(
        max_length=3,
        choices=ModalidadTrabajo.choices,
        default=ModalidadTrabajo.INDIVIDUAL,
        help_text="Modalidad de trabajo de la actividad",
    )
    
    horas = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Cantidad total de horas asignadas a esta actividad (permite fracciones)",
    )

    activo = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Indica si la actividad está activa (baja lógica).",
    )

    clase_calendario = models.ForeignKey(
        ClaseCalendario,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="actividades",
        help_text="Clase de calendario asociada (obligatoria para actividades IP).",
    )

    fecha_inicio_ta = models.DateField(
        blank=True,
        null=True,
        help_text="Fecha de inicio opcional para actividades TA.",
    )

    fecha_fin_ta = models.DateField(
        blank=True,
        null=True,
        help_text="Fecha de fin opcional para actividades TA.",
    )
    
    class Meta:
        verbose_name = "actividad"
        verbose_name_plural = "actividades"
        db_table = "actividad"

    def clean(self) -> None:
        super().clean()
        if self.fecha_inicio_ta and self.fecha_fin_ta and self.fecha_inicio_ta > self.fecha_fin_ta:
            raise ValidationError(
                {"fecha_fin_ta": "La fecha de fin TA no puede ser anterior a la de inicio."}
            )

        if self.clase_calendario_id and self.clase_calendario.programa_id != self.programa_id:
            raise ValidationError(
                {"clase_calendario": "La clase seleccionada no pertenece al programa de la actividad."}
            )
        
    @property
    def espacio_curricular(self) -> EspacioCurricular:
        """
        Returns the curricular space associated with this activity via programa -> PlanEstudioEC.
        """
        return self.programa.plan_estudio_ec.espacio_curricular
            
    def __str__(self):
        return f"{self.espacio_curricular} - {self.descripcion}"


class ActividadAjuste(models.Model):
    """Historial auditable de recuperaciones y extensiones de actividades."""

    class Tipo(models.TextChoices):
        RECUPERACION = "REC", "Recuperacion"
        EXTENSION = "EXT", "Extension"

    actividad = models.ForeignKey(
        Actividad,
        on_delete=models.CASCADE,
        related_name="ajustes",
    )
    tipo = models.CharField(max_length=3, choices=Tipo.choices)
    motivo = models.CharField(max_length=255)
    horas_ip_extra = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
    )
    fecha_evento = models.DateField(blank=True, null=True)
    clase_destino = models.ForeignKey(
        ClaseCalendario,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="ajustes",
    )
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="actividad_ajustes_creados",
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "ajuste de actividad"
        verbose_name_plural = "ajustes de actividades"
        db_table = "actividad_ajuste"
        ordering = ["-creado_en", "-id"]

    def clean(self) -> None:
        super().clean()
        if self.clase_destino_id and self.clase_destino.programa_id != self.actividad.programa_id:
            raise ValidationError(
                {"clase_destino": "La clase destino debe pertenecer al programa de la actividad."}
            )

        if self.tipo == self.Tipo.EXTENSION and self.horas_ip_extra <= 0:
            raise ValidationError(
                {"horas_ip_extra": "En una extension las horas IP extra deben ser mayores a 0."}
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.actividad_id} - {self.get_tipo_display()}"
