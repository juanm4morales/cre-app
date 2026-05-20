from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.contrib import messages
from django.db.models import Sum, Q
from django.utils import timezone

from academics.models import ConfiguracionCRE, EspacioCurricular, PlanEstudioEC
from accounts.permissions import is_admin_user
from .models import Programa, Actividad, AsignacionDocente
from .forms import ActividadForm, ProgramaForm


def _asignacion_docente_qs(user):
    """Get active assignments for a user (currently valid)."""
    return AsignacionDocente.objects.activas(fecha=timezone.now().date()).filter(docente=user)


def _programa_accesible_qs(user, ec_id):
    """Get programs accessible to user filtered by curricular space."""
    return (
        Programa.objects.filter(
			activo=True,
            plan_estudio_ec__espacio_curricular_id=ec_id,
            plan_estudio_ec__espacio_curricular__asignaciones_docente__in=_asignacion_docente_qs(user),
        )
        .distinct()
    )


def _actividad_accesible_qs(user, ec_id):
    """Get activities accessible to user filtered by curricular space."""
    return (
        Actividad.objects.filter(
			activo=True,
            programa__plan_estudio_ec__espacio_curricular_id=ec_id,
			programa__activo=True,
            programa__plan_estudio_ec__espacio_curricular__asignaciones_docente__in=_asignacion_docente_qs(user),
        )
        .distinct()
    )


def _is_admin_user(user, session=None) -> bool:
    return is_admin_user(user, session)

@login_required
def seleccionar_espacio_curricular(request):
	"""
	Vista para seleccionar primero la Carrera y luego el Espacio Curricular
	asignado al docente.
	"""
	# Get currently active assignments
	asignaciones = _asignacion_docente_qs(request.user).select_related('espacio_curricular')

	if not asignaciones.exists():
		return render(
			request,
			'planning/sin_asignaciones.html',
			{'user_name': request.user.get_full_name() or request.user.get_username()},
		)

	# Obtener los PlanEstudioEC asociados a los espacios curriculares asignados
	plan_ec_qs = (
		PlanEstudioEC.objects
		.filter(espacio_curricular_id__in=asignaciones.values_list('espacio_curricular_id', flat=True))
		.select_related('plan_estudio__carrera', 'espacio_curricular')
		.order_by('plan_estudio__carrera__nombre', 'espacio_curricular__nombre')
	)

	# Carreras únicas disponibles para el docente
	carreras = sorted({pec.plan_estudio.carrera for pec in plan_ec_qs}, key=lambda c: c.nombre)

	if request.method == 'POST':
		carrera_id = request.POST.get('carrera_id')
		plan_ec_id = request.POST.get('plan_estudio_ec_id')

		if not carrera_id or not plan_ec_id:
			messages.error(request, "Selecciona una carrera y un espacio curricular.")
		else:
			plan_ec = PlanEstudioEC.objects.filter(
				id=plan_ec_id,
				plan_estudio__carrera_id=carrera_id,
				espacio_curricular_id__in=asignaciones.values_list('espacio_curricular_id', flat=True),
			).select_related('plan_estudio__carrera').first()

			if not plan_ec:
				messages.error(request, "La combinación de carrera y espacio curricular no es válida.")
			else:
				request.session['carrera_id'] = plan_ec.plan_estudio.carrera_id
				request.session['espacio_curricular_id'] = plan_ec.espacio_curricular_id
				request.session['plan_estudio_ec_id'] = plan_ec.id
				return redirect('dashboard_ec')

	return render(
		request,
		'planning/seleccionar_ec.html',
		{
			'carreras': carreras,
			'plan_ec_list': plan_ec_qs,
			'user_name': request.user.get_full_name() or request.user.get_username(),
		},
	)

@login_required
def dashboard_ec(request):
	"""
	Dashboard principal donde el docente gestiona Programas y Actividades
	del Espacio Curricular seleccionado.
	"""
	ec_id = request.session.get('espacio_curricular_id')
	plan_ec_id = request.session.get('plan_estudio_ec_id')

	if not ec_id or not plan_ec_id:
		return redirect('seleccionar_ec')

	try:
		plan_estudio_ec = PlanEstudioEC.objects.select_related(
			'espacio_curricular', 'plan_estudio__carrera'
		).get(id=plan_ec_id, espacio_curricular_id=ec_id)
	except PlanEstudioEC.DoesNotExist:
		return redirect('seleccionar_ec')

	# Obtener programas para este espacio curricular
	programas = Programa.objects.filter(
		plan_estudio_ec=plan_estudio_ec,
		activo=True,
	).prefetch_related('actividades').annotate(
		total_horas=Sum('actividades__horas', filter=Q(actividades__activo=True))
	)

	allowed_total_horas = (
		plan_estudio_ec.espacio_curricular.creditos * ConfiguracionCRE.get_hours_per_cre()
	)
	
	if _is_admin_user(request.user, request.session):
		for programa in programas:
			programa.total_horas = programa.total_horas or 0
			programa.horas_diff = programa.total_horas - allowed_total_horas
			programa.horas_diff_abs = abs(programa.horas_diff)

	return render(
		request,
		'planning/dashboard_ec.html',
		{
			'plan_estudio_ec': plan_estudio_ec,
			'programas': programas,
			'allowed_total_horas': allowed_total_horas,
			'is_admin': _is_admin_user(request.user, request.session),
			'user_name': request.user.get_full_name() or request.user.get_username(),
		},
	)

@login_required
def programa_crear(request):
	"""Crear un nuevo programa para el espacio curricular seleccionado."""
	plan_ec_id = request.session.get('plan_estudio_ec_id')
	if not plan_ec_id:
		return redirect('seleccionar_ec')

	if request.method == 'POST':
		form = ProgramaForm(request.POST, plan_estudio_ec_id=plan_ec_id)
		if form.is_valid():
			programa = form.save(commit=False)
			programa.plan_estudio_ec_id = plan_ec_id
			programa.save()
			messages.success(request, f"Programa {programa.anio_academico} creado exitosamente.")
			return redirect('dashboard_ec')
	else:
		form = ProgramaForm(plan_estudio_ec_id=plan_ec_id)

	return render(
		request,
		'planning/programa_form.html',
		{
			'title': 'Nuevo Programa',
			'form': form,
		},
	)

@login_required
def programa_editar(request, pk: int):
	"""Editar un programa existente."""
	ec_id = request.session.get('espacio_curricular_id')
	if not ec_id:
		return redirect('seleccionar_ec')

	programa = get_object_or_404(_programa_accesible_qs(request.user, ec_id), pk=pk)

	if request.method == 'POST':
		form = ProgramaForm(request.POST, instance=programa)
		if form.is_valid():
			form.save()
			messages.success(request, f"Programa actualizado exitosamente.")
			return redirect('dashboard_ec')
	else:
		form = ProgramaForm(instance=programa)

	return render(
		request,
		'planning/programa_form.html',
		{
			'title': f'Editar Programa {programa.anio_academico}',
			'form': form,
		},
	)

@login_required
@require_http_methods(["POST"])
def programa_eliminar(request, pk: int):
	"""Eliminar un programa."""
	ec_id = request.session.get('espacio_curricular_id')
	if not ec_id:
		return redirect('seleccionar_ec')

	programa = get_object_or_404(_programa_accesible_qs(request.user, ec_id), pk=pk)
	anio = programa.anio_academico
	programa.activo = False
	programa.save(update_fields=['activo'])
	programa.actividades.update(activo=False)
	programa.unidades.update(activo=False)
	messages.warning(request, f"Programa {anio} dado de baja.")
	return redirect('dashboard_ec')

@login_required
def actividades_usuario(request):
	"""
	Lista las actividades asociadas al usuario logueado (como docente).
	Filtradas por el espacio curricular seleccionado.
	"""
	ec_id = request.session.get('espacio_curricular_id')
	if not ec_id:
		return redirect('seleccionar_ec')

	actividades = (
		_actividad_accesible_qs(request.user, ec_id)
		.select_related(
			'programa',
			'tipo_actividad',
		)
		.order_by('programa__anio_academico', 'descripcion')
	)

	user_name = request.user.get_full_name() or request.user.get_username()

	return render(
		request,
		'planning/actividades.html',
		{
			'user_name': user_name,
			'actividades': actividades,
		},
	)

@login_required
def actividad_crear(request):
	"""Crear una nueva actividad para el usuario actual."""
	ec_id = request.session.get('espacio_curricular_id')
	if not ec_id:
		return redirect('seleccionar_ec')

	# Obtener programa_id del query string si está presente
	programa_id = request.GET.get('programa')

	if request.method == 'POST':
		form = ActividadForm(request.POST, user=request.user, ec_id=ec_id, programa_id=programa_id)
		if form.is_valid():
			form.save()
			messages.success(request, "Actividad creada exitosamente.")
			return redirect('dashboard_ec')
	else:
		form = ActividadForm(user=request.user, ec_id=ec_id, programa_id=programa_id)

	return render(
		request,
		'planning/actividad_form.html',
		{
			'title': 'Nueva actividad',
			'form': form,
		},
	)

@login_required
def actividad_editar(request, pk: int):
	"""Editar una actividad existente del usuario actual."""
	ec_id = request.session.get('espacio_curricular_id')
	if not ec_id:
		return redirect('seleccionar_ec')

	actividad = get_object_or_404(_actividad_accesible_qs(request.user, ec_id), pk=pk)

	if request.method == 'POST':
		form = ActividadForm(request.POST, instance=actividad, user=request.user, ec_id=ec_id)
		if form.is_valid():
			form.save()
			messages.success(request, "Actividad actualizada exitosamente.")
			return redirect('actividades')
	else:
		form = ActividadForm(instance=actividad, user=request.user, ec_id=ec_id)

	return render(
		request,
		'planning/actividad_form.html',
		{
			'title': 'Editar actividad',
			'form': form,
		},
	)

@login_required
@require_http_methods(["POST"])
def actividad_eliminar(request, pk: int):
	"""Eliminar una actividad."""
	ec_id = request.session.get('espacio_curricular_id')
	if not ec_id:
		return redirect('seleccionar_ec')

	actividad = get_object_or_404(_actividad_accesible_qs(request.user, ec_id), pk=pk)
	descripcion = actividad.descripcion
	actividad.activo = False
	actividad.save(update_fields=['activo'])
	messages.warning(request, f"Actividad '{descripcion}' dada de baja.")
	return redirect('actividades')
