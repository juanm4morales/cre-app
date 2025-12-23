from django import forms

from .models import Actividad, Programa, UnidadPrograma

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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['anio_academico'].help_text = 'Año académico del programa'
        self.fields['descripcion'].help_text = 'Descripción general del programa (opcional)'

class UnidadProgramaForm(forms.ModelForm):
    class Meta:
        model = UnidadPrograma
        fields = [
            'numero',
            'titulo',
            'descripcion',
        ]
        widgets = {
            'numero': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': 1,
                'placeholder': '1'
            }),
            'titulo': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Título de la unidad'
            }),
            'descripcion': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 4,
                'placeholder': 'Descripción de la unidad'
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['numero'].help_text = 'Número de la unidad dentro del programa'
        self.fields['titulo'].help_text = 'Título descriptivo de la unidad'
        self.fields['descripcion'].help_text = 'Descripción detallada de los contenidos (opcional)'

class ActividadForm(forms.ModelForm):
    class Meta:
        model = Actividad
        fields = [
            'unidad_programa',
            'tipo_actividad',
            'descripcion',
            'horas',
        ]
        widgets = {
            'unidad_programa': forms.Select(attrs={'class': 'form-select'}),
            'tipo_actividad': forms.Select(attrs={'class': 'form-select'}),
            'descripcion': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Descripción de la actividad'
            }),
            'horas': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': 0,
                'placeholder': '0'
            }),
        }

    def __init__(self, *args, user=None, ec_id=None, programa_id=None, **kwargs):
        super().__init__(*args, **kwargs)
        # Filtrar unidades según el espacio curricular seleccionado
        qs = UnidadPrograma.objects.all()
        if programa_id:
            qs = qs.filter(programa_id=programa_id)
        elif ec_id:
            qs = qs.filter(programa__plan_estudio_ec__espacio_curricular_id=ec_id)
        self.fields['unidad_programa'].queryset = qs.select_related('programa').order_by('programa__anio_academico', 'numero')
        
        # Mensajes de ayuda
        self.fields['unidad_programa'].help_text = 'Selecciona la unidad del programa'
        self.fields['horas'].help_text = 'Cantidad total de horas (>= 0)'
