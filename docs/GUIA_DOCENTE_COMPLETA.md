# Guía Completa de la App (Perfil Docente)

## 1) Objetivo de la aplicación

La app permite que un/a docente:

- seleccione un espacio curricular asignado,
- cree y mantenga el programa del año académico,
- configure su agenda semanal de cursado,
- planifique actividades de Interacción Pedagógica (IP) y Trabajo Autónomo (TA),
- haga seguimiento de ejecución de clases IP,
- consulte su perfil.


## 2) Flujo recomendado (paso a paso)

1. Ingresar a la plataforma.
2. Seleccionar espacio curricular.
3. Verificar o crear el programa del año actual.
4. Configurar agenda de cursado (días y franjas horarias).
5. Generar calendario de clases del rango deseado.
6. Cargar planificación IP (vinculada a clases del calendario).
7. Cargar planificación TA (por unidades, con rango opcional).
8. Hacer seguimiento de ejecución de clases IP.
9. Revisar resumen y ajustar si hace falta.


## 3) Pantallas del perfil docente

## 3.1 Inicio / Resumen

Muestra indicadores globales del espacio y un resumen por espacio curricular:

- cantidad de espacios,
- programas activos,
- actividades cargadas,
- horas totales.

También muestra acciones recomendadas contextuales (botones reales según estado de tus datos).


## 3.2 Mis espacios curriculares

Permite elegir el espacio activo para trabajar.

Qué hace internamente:

- guarda selección en sesión del navegador,
- define el plan_estudio_ec asociado,
- redirige a programas para continuar el flujo.


## 3.3 Programas

Gestión del programa académico por año:

- crear/editar programa,
- crear programa del año actual de forma asistida,
- cargar unidades,
- asociar competencias a unidades.

Punto importante:

- sin programa actual y sin unidades activas no se puede planificar actividades correctamente.


## 3.4 Agenda de cursado

Aquí se define la regla semanal (día y horario) del programa.

- Se cargan bloques tipo Lunes 08:00-10:00, Martes 18:00-20:00, etc.
- Estos bloques son la base para generar ocurrencias concretas de clase en calendario.


## 3.5 Planificación IP

Permite crear actividades de interacción pedagógica asociadas a una clase concreta.

- Selección desde calendario.
- Actividad IP vinculada a clase_calendario.
- Asociación de unidades.


## 3.6 Planificación TA

Permite crear actividades de trabajo autónomo.

- No requiere clase de calendario.
- Se asocia a unidades.
- Puede tener rango de fechas (opcional).


## 3.7 Seguimiento (Ejecución IP)

Permite registrar lo ocurrido en cada clase:

- estado (planificada, dictada, cancelada),
- observaciones,
- ajustes/recuperaciones/extensiones de actividades.


## 3.8 Perfil

Muestra datos reales del usuario (lectura) con estructura de formulario.


## 4) ¿Cómo funciona la generación del calendario?

Esta es la parte clave de tu consulta.

La generación de calendario toma reglas semanales y crea clases concretas por fecha.

### 4.1 Requisitos previos

Para que funcione bien:

1. Debe existir un programa activo.
2. Deben existir días de clase activos en ese programa.
3. Debe indicarse un rango válido: fecha_desde y fecha_hasta.
4. Puede elegirse sobrescribir = true/false.


### 4.2 Parámetros

- programa_id: programa objetivo.
- fecha_desde: inicio del rango.
- fecha_hasta: fin del rango.
- sobrescribir: si actualiza clase existente en esa fecha.


### 4.3 Algoritmo (qué hace)

Para cada día del rango:

1. Calcula el weekday (lunes=0 ... domingo=6).
2. Busca si hay regla semanal activa para ese weekday.
3. Si no hay regla, no crea clase.
4. Si hay regla:
   - si ya existe clase en esa fecha para el programa:
     - con sobrescribir=true: actualiza el vínculo de día de clase y cuenta como updated,
     - con sobrescribir=false: no toca la clase y cuenta como skipped.
   - si no existe clase: crea nueva clase y cuenta como created.


### 4.4 Resultado de la operación

Devuelve contadores:

- created: clases nuevas creadas,
- updated: clases existentes actualizadas,
- skipped: fechas con clase existente no modificada,
- además IDs creados/actualizados.


### 4.5 Casos comunes

- Si no hay días de clase activos: created=0, updated=0, skipped=0.
- Si el rango es inválido (desde > hasta): validación bloquea.
- Si no tienes permisos sobre el programa: retorna error de permisos/no encontrado.


## 5) ¿Por qué a veces no “aparece” algo en pantalla?

Las causas más frecuentes:

1. No hay espacio seleccionado.
2. Falta programa actual.
3. No hay unidades activas.
4. No se generó calendario aún.
5. Se está filtrando por un estado/rango que no incluye tus datos.


## 6) Significado de estados en clases

- PLAN: planificada.
- DICT: dictada.
- CANC: cancelada.


## 7) Reglas prácticas para trabajar sin errores

1. Crear/verificar programa actual primero.
2. Cargar unidades del programa.
3. Configurar agenda semanal.
4. Generar calendario por rango.
5. Recién ahí cargar actividades IP masivamente.
6. Cargar TA por unidades y revisar fechas.
7. En ejecución IP, actualizar estado de clase y observaciones.


## 8) FAQ rápida

### ¿Para qué sirve “Acciones recomendadas”?

Es una guía operativa contextual. No es decorativo: cambia según tus datos y te lleva directo al siguiente paso que falta.

### ¿Por qué en “Resumen por espacio curricular” puede verse vacío?

Cuando el backend devuelve referencias de espacio con forma distinta (objeto o id), si no se resuelve bien el nombre puede verse en blanco. La resolución fue robustecida para evitar valores vacíos.

### ¿Debo usar “Generar calendario” siempre?

Sí, cuando cambias agenda semanal o abres nuevo período. Es el puente entre reglas semanales y fechas concretas de clase.


## 9) Qué hace la app para mantener consistencia de datos

- Actualiza estado local al crear/editar/eliminar.
- Invalida y refresca vistas en segundo plano tras mutaciones.
- Refresca al volver foco de pestaña para evitar datos stale.


## 10) Próximas mejoras sugeridas (docente)

1. Edición de perfil (guardar cambios reales).
2. Vista de trazabilidad por clase (historial completo de ajustes).
3. Exportación docente por programa/actividad.
4. Validaciones visuales previas a cierre de planificación.
