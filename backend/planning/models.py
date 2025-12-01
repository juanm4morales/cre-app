from django.db import models
from django.conf import settings

from academics.models import EspacioCurricular

# Create your models here.
class AsignacionDocente(models.Model):
    """
    Model that represents the assignment of a teacher to a curricular space.
    """
    CATEGORIA_CHOICES = [
        ('TIT', 'Titular'),
        ('ADJ', 'Adjunto'),
        ('JTP', 'Jefe de Trabajos Prácticos'),
        ('AYU', 'Ayudante'),
    ]
    
    docente = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='asignaciones_docente'
    )
    espacio_curricular = models.ForeignKey(
        EspacioCurricular,
        on_delete=models.CASCADE,
        related_name='asignaciones_docente'
    )
    
    categoria = models.CharField(
        max_length=5,
        choices=CATEGORIA_CHOICES,
        help_text="Categoría docente"
    )
    
    class Meta:
        verbose_name = "asignación de docente"
        verbose_name_plural = "asignaciones de docentes"
        db_table = "asignacion_docente"
        unique_together = ('docente', 'espacio_curricular', 'categoria')
        
    def __str__(self):
        return f"{self.docente} - {self.espacio_curricular}"
    
class TipoActividad(models.Model):
    """
    Model that represents a type of activity within a curricular space.
    """
    
    TIPO_DEDICACION_CHOICES = [
        ("IP", "Interacción Pedagógica (IP)"),
        ("TA", "Trabajo Autónomo (TA)"),
    ]
    
    MODALIDAD_TRABAJO_CHOICES = [
        ("GRU", "Trabajo en Grupo"),
        ("IND", "Trabajo Individual"),
    ]
    
    nombre = models.CharField(
        max_length=100,
        unique=True,
        help_text="Nombre del tipo de actividad"
    )
    
    descripcion = models.TextField(
        help_text="Descripción del tipo de actividad"
    )
    
    tipo_dedicacion = models.CharField(
        max_length=5,
        choices=TIPO_DEDICACION_CHOICES,
        help_text="Tipo de dedicación de la actividad"
    )
    
    modalidad_trabajo = models.CharField(
        max_length=5,
        choices=MODALIDAD_TRABAJO_CHOICES,
        help_text="Modalidad de trabajo de la actividad"
    )
    
    class Meta:
        verbose_name = "tipo de actividad"
        verbose_name_plural = "tipos de actividades"
        db_table = "tipo_actividad"
        
    def __str__(self):
        return self.nombre
    
class Actividad(models.Model):
    """
    Model that represents an activity assigned to a teacher within a curricular space.
    """
    
    asignacion_docente = models.ForeignKey(
        AsignacionDocente,
        on_delete=models.CASCADE,
        related_name='actividades',
        help_text="Docente y espacio curricular asociados a esta actividad"
    )
    
    tipo_actividad = models.ForeignKey(
        TipoActividad,
        on_delete=models.CASCADE,
        related_name='actividades',
        help_text="Tipo de actividad"
    )
        
    descripcion = models.CharField(
        max_length=255,
        help_text="Descripción de la actividad"
    )
    
    horas = models.PositiveIntegerField(
        default=0,
        help_text="Cantidad total de horas asignadas a esta actividad"
    )
    
    
    class Meta:
        verbose_name = "actividad"
        verbose_name_plural = "actividades"
        db_table = "actividad"
        
    @property
    def espacio_curricular(self) -> EspacioCurricular:
        """
        Returns the curricular space associated with this activity through the teacher assignment.
        """
        return self.asignacion_docente.espacio_curricular
        
    def __str__(self):
        return f"{self.espacio_curricular} - {self.descripcion}"
    
    