from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator

from academics.models import PlanEstudioEC, EspacioCurricular

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
        help_text="Año académico al que pertenece el programa"
    )
    
    descripcion = models.TextField(
        blank=True,
        help_text="Descripción del programa"
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
    
class UnidadPrograma(models.Model):
    """
    Model that represents a unit within a program.
    """
    programa = models.ForeignKey(
        Programa,
        on_delete=models.CASCADE,
        related_name='unidades',
        help_text="Programa al que pertenece la unidad"
    )
    numero = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        help_text="Número de la unidad dentro del programa"
    )
    
    titulo = models.CharField(
        max_length=255,
        help_text="Título de la unidad del programa"
    )
    
    descripcion = models.TextField(
        blank=True,
        help_text="Descripción de la unidad del programa"
    )
    
    class Meta:
        verbose_name = "unidad de programa"
        verbose_name_plural = "unidades de programa"
        db_table = "unidad_programa"
        constraints = [
            models.UniqueConstraint(
                fields=['programa', 'numero'],
                name='unique_unidad_programa_numero'
            )
        ]
        
    def __str__(self):
        return f"{self.programa} - Unidad {self.numero}: {self.titulo}"

class AsignacionDocente(models.Model):
    """
    Model that represents the assignment of a teacher to a curricular space.
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
    
    activo = models.BooleanField(
        default=True,
        help_text="Indica si la asignación docente está activa"
    )
    
    class Meta:
        verbose_name = "asignación de docente"
        verbose_name_plural = "asignaciones de docentes"
        db_table = "asignacion_docente"     
        constraints = [
            models.UniqueConstraint(
                fields=('docente', 'espacio_curricular'),
                name='unique_asignacion_docente'
            )
        ]
        
    def __str__(self):
        return f"{self.docente} - {self.espacio_curricular}"
    
class TipoActividad(models.Model):
    """
    Model that represents a type of activity within a curricular space.
    """   
    class TipoDedicacion(models.TextChoices):
        INTERACCION_PEDAGOGICA = "IP", "Interacción Pedagógica (IP)"
        TRABAJO_AUTONOMO = "TA", "Trabajo Autónomo (TA)"
    
    class ModalidadTrabajo(models.TextChoices):
        GRUPO = "GRU", "Trabajo en Grupo"
        INDIVIDUAL = "IND", "Trabajo Individual"
    
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
    
    modalidad_trabajo = models.CharField(
        max_length=5,
        choices=ModalidadTrabajo.choices,
        null=True,
        blank=True,
        help_text="Modalidad de trabajo de la actividad (opcional)"
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
    Model that represents an activity assigned to a teacher within a curricular space.
    """
    unidad_programa = models.ForeignKey(
        UnidadPrograma,
        on_delete=models.CASCADE,
        related_name='actividades',
        help_text="Unidad del programa asociada a esta actividad",
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
    
    horas = models.PositiveIntegerField(
        default=0,
        validators=[MinValueValidator(0)],
        help_text="Cantidad total de horas asignadas a esta actividad"
    )
    
    class Meta:
        verbose_name = "actividad"
        verbose_name_plural = "actividades"
        db_table = "actividad"
        
    @property
    def espacio_curricular(self) -> EspacioCurricular:
        """
        Returns the curricular space associated via la unidad -> programa -> PlanEstudioEC.
        """
        return self.unidad_programa.programa.plan_estudio_ec.espacio_curricular
    
    def clean(self):
        """
        Guarantees that la unidad está asociada a un programa con espacio curricular definido.
        """
        if self.unidad_programa_id:
            programa = self.unidad_programa.programa
            if not programa or not programa.plan_estudio_ec_id:
                raise ValidationError({
                    'unidad_programa': (
                        "La unidad debe pertenecer a un programa con un espacio curricular asociado."
                    ),
                })
            
    def __str__(self):
        return f"{self.espacio_curricular} - {self.descripcion}"