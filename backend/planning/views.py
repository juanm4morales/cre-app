from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib import messages

from academics.models import EspacioCurricular, PlanEstudioEC
from .models import Programa, UnidadPrograma, Actividad, AsignacionDocente
from .forms import ActividadForm, ProgramaForm, UnidadProgramaForm

@login_required
def seleccionar_espacio_curricular(request):
	"""
	Vista para que el docente seleccione el espacio curricular con el que quiere trabajar.
	Muestra solo los espacios curriculares asignados al docente.
	"""
	# Obtener los espacios curriculares asignados al docente
	asignaciones = AsignacionDocente.objects.filter(
		docente=request.user,
		activo=True
	).select_related('espacio_curricular')

	if not asignaciones.exists():
		return render(
			request,
			'planning/sin_asignaciones.html',
			{'user_name': request.user.get_full_name() or request.user.get_username()},
		)

	# Si solo hay una asignación, redirigir directamente
	if asignaciones.count() == 1:
		asignacion = asignaciones.first()
		request.session['espacio_curricular_id'] = asignacion.espacio_curricular.id
		request.session['plan_estudio_ec_id'] = asignacion.espacio_curricular.planes_estudio.first().id
		return redirect('dashboard_ec')

	if request.method == 'POST':
		ec_id = request.POST.get('espacio_curricular_id')
		if ec_id:
			request.session['espacio_curricular_id'] = int(ec_id)
			# Obtener el plan_estudio_ec para este espacio curricular
			plan_ec = PlanEstudioEC.objects.filter(espacio_curricular_id=ec_id).first()
			if plan_ec:
				request.session['plan_estudio_ec_id'] = plan_ec.id
			return redirect('dashboard_ec')

	return render(
		request,
		'planning/seleccionar_ec.html',
		{
			'asignaciones': asignaciones,
			'user_name': request.user.get_full_name() or request.user.get_username(),
		},
	)

@login_required
def dashboard_ec(request):
	"""
	Dashboard principal donde el docente gestiona Programas, Unidades y Actividades
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
		plan_estudio_ec=plan_estudio_ec
	).prefetch_related('unidades')

	return render(
		request,
		'planning/dashboard_ec.html',
		{
			'plan_estudio_ec': plan_estudio_ec,
			'programas': programas,
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
		form = ProgramaForm(request.POST)
		if form.is_valid():
			programa = form.save(commit=False)
			programa.plan_estudio_ec_id = plan_ec_id
			programa.save()
			messages.success(request, f"Programa {programa.anio_academico} creado exitosamente.")
			return redirect('dashboard_ec')
	else:
		form = ProgramaForm()

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
	programa = get_object_or_404(Programa, pk=pk)

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
	programa = get_object_or_404(Programa, pk=pk)
	anio = programa.anio_academico
	programa.delete()
	messages.warning(request, f"Programa {anio} eliminado.")
	return redirect('dashboard_ec')

@login_required
def unidad_crear(request, programa_id: int):
	"""Crear una nueva unidad en un programa."""
	programa = get_object_or_404(Programa, pk=programa_id)
	
	if request.method == 'POST':
		form = UnidadProgramaForm(request.POST)
		if form.is_valid():
			unidad = form.save(commit=False)
			unidad.programa = programa
			unidad.save()
			messages.success(request, f"Unidad {unidad.numero} creada exitosamente.")
			return redirect('dashboard_ec')
	else:
		form = UnidadProgramaForm()

	return render(
		request,
		'planning/unidad_form.html',
		{
			'title': 'Nueva Unidad',
			'form': form,
			'programa': programa,
		},
	)

@login_required
def unidad_editar(request, pk: int):
	"""Editar una unidad existente."""
	unidad = get_object_or_404(UnidadPrograma, pk=pk)

	if request.method == 'POST':
		form = UnidadProgramaForm(request.POST, instance=unidad)
		if form.is_valid():
			form.save()
			messages.success(request, f"Unidad actualizada exitosamente.")
			return redirect('dashboard_ec')
	else:
		form = UnidadProgramaForm(instance=unidad)

	return render(
		request,
		'planning/unidad_form.html',
		{
			'title': f'Editar Unidad {unidad.numero}',
			'form': form,
			'programa': unidad.programa,
		},
	)

@login_required
@require_http_methods(["POST"])
def unidad_eliminar(request, pk: int):
	"""Eliminar una unidad."""
	unidad = get_object_or_404(UnidadPrograma, pk=pk)
	numero = unidad.numero
	unidad.delete()
	messages.warning(request, f"Unidad {numero} eliminada.")
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
		Actividad.objects
		.filter(unidad_programa__programa__plan_estudio_ec__espacio_curricular_id=ec_id)
		.select_related(
			'unidad_programa__programa',
			'tipo_actividad',
		)
		.order_by('unidad_programa__programa__anio_academico', 'unidad_programa__numero')
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

	if request.method == 'POST':
		form = ActividadForm(request.POST, user=request.user, ec_id=ec_id)
		if form.is_valid():
			form.save()
			messages.success(request, "Actividad creada exitosamente.")
			return redirect('actividades')
	else:
		form = ActividadForm(user=request.user, ec_id=ec_id)

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
	actividad = get_object_or_404(Actividad, pk=pk)
	ec_id = request.session.get('espacio_curricular_id')

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
	actividad = get_object_or_404(Actividad, pk=pk)
	descripcion = actividad.descripcion
	actividad.delete()
	messages.warning(request, f"Actividad '{descripcion}' eliminada.")
	return redirect('actividades')

@login_required
def actividad_crear_programa(request, programa_id: int):
	"""Crear una actividad filtrando unidades por el programa dado."""
	programa = get_object_or_404(Programa, pk=programa_id)
	ec_id = programa.plan_estudio_ec.espacio_curricular_id

	if request.method == 'POST':
		form = ActividadForm(request.POST, user=request.user, ec_id=ec_id, programa_id=programa.id)
		if form.is_valid():
			form.save()
			messages.success(request, "Actividad creada exitosamente.")
			if 'add_another' in request.POST:
				return redirect('actividad_crear_programa', programa_id=programa.id)
			return redirect('dashboard_ec')
	else:
		form = ActividadForm(user=request.user, ec_id=ec_id, programa_id=programa.id)

	return render(
		request,
		'planning/actividad_form.html',
		{
			'title': f'Nueva actividad · Programa {programa.anio_academico}',
			'form': form,
		},
	)