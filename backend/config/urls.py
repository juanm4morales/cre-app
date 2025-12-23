"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect
from planning.views import (
    seleccionar_espacio_curricular,
    dashboard_ec,
    actividades_usuario,
    actividad_crear,
    actividad_editar,
    actividad_eliminar,
    programa_crear,
    programa_editar,
    programa_eliminar,
    unidad_crear,
    unidad_editar,
    unidad_eliminar,
    actividad_crear_programa,
)

urlpatterns = [
    # Root: redirect based on auth status
    path('', lambda request: redirect('seleccionar_ec') if request.user.is_authenticated else redirect('login'), name='home'),
    path('admin/', admin.site.urls),
    # Auth routes (login, logout, password management)
    path('accounts/', include('django.contrib.auth.urls')),
    # Selection and dashboard
    path('seleccionar-ec/', seleccionar_espacio_curricular, name='seleccionar_ec'),
    path('dashboard/', dashboard_ec, name='dashboard_ec'),
    # Programs routes
    path('programas/nuevo/', programa_crear, name='programa_nueva'),
    path('programas/<int:pk>/editar/', programa_editar, name='programa_editar'),
    path('programas/<int:pk>/eliminar/', programa_eliminar, name='programa_eliminar'),
    # Units routes
    path('programas/<int:programa_id>/unidades/nueva/', unidad_crear, name='unidad_nueva'),
    path('unidades/<int:pk>/editar/', unidad_editar, name='unidad_editar'),
    path('unidades/<int:pk>/eliminar/', unidad_eliminar, name='unidad_eliminar'),
    # Activity scoped to program
    path('programas/<int:programa_id>/actividades/nueva/', actividad_crear_programa, name='actividad_nueva_programa'),
    # Activities page for logged-in users
    path('actividades/', actividades_usuario, name='actividades'),
    path('actividades/nueva/', actividad_crear, name='actividad_nueva'),
    path('actividades/<int:pk>/editar/', actividad_editar, name='actividad_editar'),
    path('actividades/<int:pk>/eliminar/', actividad_eliminar, name='actividad_eliminar'),
]
