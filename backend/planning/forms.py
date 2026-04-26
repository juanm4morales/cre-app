from django import forms
from django.core.exceptions import ValidationError

from .models import Actividad, Programa, TipoActividad, Unidad

class ProgramaForm(forms.ModelForm):
    class Meta:
        model = Programa
        fields = [
            'anio_academico',
            'descripcion',
        ]
        widgets = {
            'anio_academico': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': 1939,
                'placeholder': 'Ej: 2024'
            }),
            'descripcion': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Descripción del programa'
            }),
        }

    def __init__(self, *args, plan_estudio_ec_id=None, **kwargs):
        self.plan_estudio_ec_id = plan_estudio_ec_id
        super().__init__(*args, **kwargs)
        self.fields['anio_academico'].help_text = 'Año académico del programa'
        self.fields['descripcion'].help_text = 'Descripción general del programa (opcional)'

    def clean_anio_academico(self):
        anio_academico = self.cleaned_data.get('anio_academico')
        if not self.plan_estudio_ec_id:
            return anio_academico

        # Validar unicidad solo si es un nuevo programa o si cambió el año
        qs = Programa.objects.filter(
            plan_estudio_ec_id=self.plan_estudio_ec_id,
            anio_academico=anio_academico
        )
        if self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        
        if qs.exists():
            raise ValidationError(
                f'Ya existe un programa para el año {anio_academico} en este espacio curricular.'
            )
        return anio_academico

class ActividadForm(forms.ModelForm):
    class Meta:
        model = Actividad
        fields = [
            'programa',
            'unidades',
            'tipo_actividad',
            'modalidad_trabajo',
            'descripcion',
            'horas',
        ]
        widgets = {
            'programa': forms.Select(attrs={'class': 'form-select'}),
            'unidades': forms.SelectMultiple(attrs={'class': 'form-select'}),
            'tipo_actividad': forms.Select(attrs={'class': 'form-select'}),
            'modalidad_trabajo': forms.Select(attrs={'class': 'form-select'}),
            'descripcion': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Descripción de la actividad'
            }),
            'horas': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': 0,
                'step': '0.01',
                'placeholder': '0'
            }),
        }

    def __init__(self, *args, user=None, ec_id=None, programa_id=None, **kwargs):
        super().__init__(*args, **kwargs)
        # Filtrar programas según el espacio curricular seleccionado
        qs = Programa.objects.all()
        qs = qs.filter(activo=True)
        if programa_id:
            qs = qs.filter(id=programa_id)
        elif ec_id:
            qs = qs.filter(plan_estudio_ec__espacio_curricular_id=ec_id)
        self.fields['programa'].queryset = qs.select_related('plan_estudio_ec').order_by('-anio_academico')

        programa_for_units = None
        if self.instance.pk:
            programa_for_units = self.instance.programa
        elif programa_id:
            programa_for_units = qs.filter(id=programa_id).first()
        elif self.data.get('programa'):
            programa_for_units = qs.filter(id=self.data.get('programa')).first()

        if programa_for_units:
            self.fields['unidades'].queryset = Unidad.objects.filter(
                programa=programa_for_units
            ).filter(
                activo=True
            ).order_by('numero')
        else:
            self.fields['unidades'].queryset = Unidad.objects.none()

        tipo_default = TipoActividad.objects.filter(
            tipo_dedicacion=TipoActividad.TipoDedicacion.TRABAJO_AUTONOMO
        ).order_by('id').first()
        if tipo_default and not self.instance.pk:
            self.fields['tipo_actividad'].initial = tipo_default.pk
        
        # Mensajes de ayuda
        self.fields['programa'].help_text = 'Selecciona el programa'
        self.fields['unidades'].help_text = 'Selecciona una o más unidades del programa'
        self.fields['horas'].help_text = 'Cantidad total de horas (>= 0)'
