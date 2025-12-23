from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
# Create your models here.

class ConfiguracionCRE(models.Model):
    """
    Model that represents the configuration settings for CRE (Curricular Required Experience).
    """
    horas_por_cre = models.PositiveIntegerField(
        default=settings.DEFAULT_CRE_HOURS,
        help_text="Número predeterminado de horas CRE asignadas a cada carrera"
    )
    actualizado_en = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "configuración CRE"
        db_table = "configuracion_cre"
        
    def __str__(self):
        return f"{self.horas_por_cre} horas por CRE"
    
    @classmethod
    def get_hours_per_cre(cls) -> int:
        config = cls.objects.first()
        if config:
            return config.horas_por_cre
        return settings.DEFAULT_CRE_HOURS

class UnidadAcademica(models.Model):
    """
    Model that represents a university faculty.
    """
    nombre = models.CharField(max_length=100)
    sigla = models.CharField(
        max_length=10,
        unique=True,
        help_text="Código único para identificar la unidad académica"
    )
    
    class Meta:
        verbose_name = "unidad académica"
        verbose_name_plural = "unidades académicas"
        db_table = "unidad_academica"
        
    def __str__(self):
        return f"{self.sigla} - {self.nombre}"

class Carrera(models.Model):
    """
    Model that represents a university degree program.
    """
    
    class DegreeLevel(models.TextChoices):
        PREGRADO = 'PG', 'Pregrado'
        GRADO = 'G', 'Grado'
    
    nombre = models.CharField(max_length=255)
    codigo = models.CharField(
        max_length=20,
        unique=True,
        help_text="Código único para identificar la carrera"
    )
    unidad_academica = models.ForeignKey(
        UnidadAcademica,
        on_delete=models.PROTECT,
        related_name='carreras'
    )
    
    nivel = models.CharField(
        max_length=5,
        choices=DegreeLevel.choices,
        default=DegreeLevel.GRADO,
        help_text="Nivel de la carrera (Pregrado o Grado)"
    )
    
    class Meta:
        verbose_name = "carrera"
        verbose_name_plural = "carreras"
        db_table = "carrera"
        
    def __str__(self):
        return f"{self.nombre} ({self.unidad_academica.sigla})"
    
   

class PlanEstudio(models.Model):
    """
    Model that represents a study plan for a degree program.
    """
    carrera = models.ForeignKey(
        Carrera,
        on_delete=models.PROTECT,
        related_name='planes_estudio'
    )
    
    espacios_curriculares = models.ManyToManyField(
        'EspacioCurricular',
        through='PlanEstudioEC',
        related_name='planes_estudio'
    )
    
    nombre = models.CharField(max_length=255)
    
    ordenanza = models.CharField(
        max_length=100,
        unique=True,
        help_text="Ordenanza que aprueba el plan de estudio"
    )

    descripcion = models.TextField(
        blank=True,
        null=True
    )
    
    creditos = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        help_text="Número total de créditos del plan de estudios"
    )
    
    vigente_desde = models.DateField(
        help_text="Fecha desde la cual el plan de estudio está vigente"
    )
    
    vigente_hasta = models.DateField(
        blank=True,
        null=True,
        help_text="Fecha hasta la cual el plan de estudio estuvo vigente (dejar en blanco si aún está vigente)"
    )
    
    class Meta:
        verbose_name = "plan de estudio"
        verbose_name_plural = "planes de estudio"
        db_table = "plan_estudio"
        constraints = [
            models.UniqueConstraint(
                fields=['carrera', 'nombre'],
                name='unique_plan_estudio_carrera'
            )
        ]
        
    def __str__(self):
        return f"{self.nombre} - {self.carrera.nombre}"
    
    @property
    def horas(self) -> int:
        """
        Calculate the total hours for the degree program based on credits.
        """
        horas_por_credito = ConfiguracionCRE.get_hours_per_cre()
        return self.creditos * horas_por_credito
    

class PlanEstudioEC(models.Model):
    """
    Intermediate model to link study plans with curricular spaces.
    """
    plan_estudio = models.ForeignKey(
        PlanEstudio,
        on_delete=models.PROTECT,
    )
    
    espacio_curricular = models.ForeignKey(
        'EspacioCurricular',
        on_delete=models.PROTECT,
    )
    
    class Meta:
        verbose_name = "plan de estudio - espacio curricular"
        verbose_name_plural = "planes de estudio - espacios curriculares"
        db_table = "plan_estudio_espacio_curricular"
        constraints = [
            models.UniqueConstraint(
                fields=['plan_estudio', 'espacio_curricular'],
                name='unique_plan_estudio_ec'
            )
        ]
        
    def __str__(self):
        return f"{self.plan_estudio.nombre} - {self.espacio_curricular.nombre}"
    
class EspacioCurricular(models.Model):
    """
    Model that represents a curricular space (course/module) within a study plan.
    """
    
    class TipoEspacio(models.TextChoices):
        T1_ASIGNATURAS = "T1", "T1 - Asignaturas"
        T2_SEMINARIOS = "T2", "T2 - Seminarios"
        T3_TALLERES_LAB = "T3", "T3 - Talleres y laboratorios"
        T4_ACTIV_PROF_ESPEC = "T4", "T4 - Actividades profesionales especiales"
    
    class Periodo(models.TextChoices):
        ANUAL = "ANUAL", "Anual"
        PRIMER_SEMESTRE = "1S", "1er Semestre"
        SEGUNDO_SEMESTRE = "2S", "2do Semestre"
    
    codigo = models.CharField(
        max_length=20,
        help_text="Código único para identificar el espacio curricular"
    )
    
    nombre = models.CharField(max_length=255)
    
    tipo_espacio = models.CharField(
        max_length=3,
        choices=TipoEspacio.choices,
        help_text="Tipo de espacio curricular"
    )
    
    anio_cursada = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        help_text="Año de cursada del espacio curricular dentro del plan de estudio"
    )
    
    periodo = models.CharField(
        max_length=5,
        choices=Periodo.choices,
        help_text="Período en el que se dicta el espacio curricular"
    )
    
    creditos = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        help_text="Número de créditos asignados al espacio curricular"
    )
    
    horas_ip = models.PositiveIntegerField(
        validators=[MinValueValidator(0)],
        help_text="Número de horas de Interacción Pedagógica (IP) del espacio curricular"
    )
    
    horas_ta = models.PositiveIntegerField(
        validators=[MinValueValidator(0)],
        help_text="Número de horas de trabajo autónomo (TA) del espacio curricular"
    )
        
    class Meta:
        verbose_name = "espacio curricular"
        verbose_name_plural = "espacios curriculares"
        db_table = "espacio_curricular"
        
    def __str__(self):
        return f"{self.codigo} - {self.nombre}"
    
    @property
    def horas_totales(self) -> int:
        """
        Calculate the total hours for the curricular space.
        """
        return self.horas_ip + self.horas_ta