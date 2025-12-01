from django.db import models
from django.conf import settings
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

class Facultad(models.Model):
    """
    Model that represents a university faculty.
    """
    nombre = models.CharField(max_length=100)
    sigla = models.CharField(
        max_length=10,
        unique=True,
        help_text="Código único para identificar la facultad"
    )
    
    class Meta:
        verbose_name = "facultad"
        verbose_name_plural = "facultades" 
        db_table = "facultad" # Nombre de la tabla en la base de datos
        
    def __str__(self):
        return f"{self.sigla} - {self.nombre}"

class Carrera(models.Model):
    """
    Model that represents a university degree program.
    """
    
    DEGREE_LEVELS = [
        ('PG', 'Pregrado'),
        ('G', 'Grado'),
    ]
    
    nombre = models.CharField(max_length=255)
    codigo = models.CharField(
        max_length=20,
        unique=True,
        help_text="Código único para identificar la carrera"
    )
    facultad = models.ForeignKey(
        Facultad,
        on_delete=models.CASCADE,
        related_name='carreras'
    )
    
    nivel = models.CharField(
        max_length=5,
        choices=DEGREE_LEVELS,
        default='G',
        help_text="Nivel de la carrera (Pregrado o Grado)"
    )
    
    creditos = models.PositiveIntegerField(
        help_text="Número total de créditos requeridos para completar la carrera"
    )
    
    class Meta:
        verbose_name = "carrera"
        verbose_name_plural = "carreras"
        db_table = "carrera"
        
    def __str__(self):
        return f"{self.nombre} ({self.facultad.sigla})"
    
    @property
    def horas(self) -> int:
        """
        Calculate the total hours for the degree program based on credits.
        Assuming 1 credit equals 15 hours.
        """
        horas_por_credito = ConfiguracionCRE.get_hours_per_cre()
        return self.creditos * horas_por_credito

class PlanEstudio(models.Model):
    """
    Model that represents a study plan for a degree program.
    """
    carrera = models.ForeignKey(
        Carrera,
        on_delete=models.CASCADE,
        related_name='planes_estudio'
    )
    
    nombre = models.CharField(max_length=255)

    descripcion = models.TextField(
        blank=True,
        null=True
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
        unique_together = ('carrera', 'nombre')
        
    def __str__(self):
        return f"{self.nombre} - {self.carrera.nombre}" 
    
class EspacioCurricular(models.Model):
    """
    Model that represents a curricular space (course/module) within a study plan.
    """
    
    TIPO_ESPACIO_CHOICES = [
        ("T1","T1 - Asignaturas"),
        ("T2", "T2 - Seminarios"),
        ("T3", "T3 - Talleres y laboratorios"),
        ("T4", "T4 - Actividades profesionales especiales")
    ]
    
    PERIODO_CHOICES = [
        ("ANUAL", "Anual"),
        ("1S", "1er Semestre"),
        ("2S", "2do Semestre"),
    ]
    
    plan_estudio = models.ForeignKey(
        PlanEstudio,
        on_delete=models.CASCADE,
        related_name='espacios_curriculares'
    )
    
    codigo = models.CharField(
        max_length=20,
        help_text="Código único para identificar el espacio curricular"
    )
    
    nombre = models.CharField(max_length=255)
    
    tipo_espacio = models.CharField(
        max_length=3,
        choices=TIPO_ESPACIO_CHOICES,
        help_text="Tipo de espacio curricular"
    )
    
    anio = models.PositiveSmallIntegerField(
        help_text="Año en el que se dicta el espacio curricular dentro del plan de estudio"
    )
    
    periodo = models.CharField(
        max_length=5,
        choices=PERIODO_CHOICES,
        help_text="Período en el que se dicta el espacio curricular"
    )
    
    creditos = models.PositiveIntegerField(
        help_text="Número de créditos asignados al espacio curricular"
    )
    
    horas_ip = models.PositiveIntegerField(
        help_text="Número de horas de Interacción Pedagógica (IP) del espacio curricular"
    )
    
    horas_ta = models.PositiveIntegerField(
        help_text="Número de horas de trabajo autónomo (TA) del espacio curricular"
    )
        
    class Meta:
        verbose_name = "espacio curricular"
        verbose_name_plural = "espacios curriculares"
        db_table = "espacio_curricular"
        unique_together = ('plan_estudio', 'codigo')
        
    def __str__(self):
        return f"{self.codigo} - {self.nombre} ({self.plan_estudio.nombre})"
    
    @property
    def horas_totales(self) -> int:
        """
        Calculate the total hours for the curricular space.
        Total hours = Horas IP + Horas TA
        """
        return self.horas_ip + self.horas_ta