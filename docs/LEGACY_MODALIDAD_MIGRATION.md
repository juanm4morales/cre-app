# Resguardo de modalidad antes de la migración 0009

Procedimiento manual para un futuro PostgreSQL que aún esté en `planning.0008` o anterior y conserve `tipo_actividad.modalidad_trabajo`. No conecta a ninguna base, no ejecuta migraciones ni cambia datos.

## Antes de empezar

- Aplique primero cualquier decisión de producto/esquema en Azure, la rama autoritativa; sincronice luego las variantes derivadas. No modifique aquí las ramas históricas `dev`, `frontend-modernization`, `legacy/cross-site` ni `unidades`.
- Confirme aprobación, ventana de mantenimiento, acceso de solo lectura para consultas y destino local autorizado para el CSV. No guarde datos exportados en el repositorio, tickets o canales no aprobados.
- Deténgase si no puede verificar la identidad del servidor/base, no tiene autorización, el estado de migraciones o el esquema no coincide con lo esperado, o no hay copia completa recuperable y probada.

## Inspeccionar y exportar

Establezca `umask 077` en la terminal local **antes de abrir `psql`**. Abra `psql` usando el mecanismo de credenciales aprobado (no ponga la contraseña en la línea de comandos). Primero confirme la conexión y estado, por ejemplo:

```sql
SELECT current_database() AS database_name,
       current_user AS database_user,
       inet_server_addr() AS server_address,
       inet_server_port() AS server_port;

SELECT app, name, applied
FROM django_migrations
WHERE app = 'planning'
  AND name IN (
      '0008_actividad_fecha_fin_ta_actividad_fecha_inicio_ta_and_more',
      '0009_remove_tipoactividad_modalidad_trabajo',
      '0010_alter_actividad_modalidad_trabajo',
      '0011_seed_ip_tipo_actividad',
      '0012_programa_competencias_programa_fundamentacion_and_more'
  )
ORDER BY applied;

SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'tipo_actividad'
  AND column_name = 'modalidad_trabajo';
```

Compruebe manualmente que es la base prevista, que su secuencia aplicada llega como máximo a `0008` (y `0009` no está aplicada) y que la consulta de esquema devuelve exactamente la columna esperada. Si falta un registro por ser una instalación antigua, investigue antes; no deduzca el estado solo del número máximo. **Ante cualquier duda, deténgase; no intente aplicar ni revertir migraciones para habilitar la exportación.**

En la misma sesión `psql`, abra una instantánea de solo lectura y haga los recuentos. `REPEATABLE READ` mantiene una instantánea consistente para las consultas de esta transacción:

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

SELECT count(*) AS total_tipos FROM tipo_actividad;

SELECT modalidad_trabajo, count(*) AS tipo_count
FROM tipo_actividad
GROUP BY modalidad_trabajo
ORDER BY modalidad_trabajo NULLS FIRST;

SELECT ta.id AS tipo_actividad_id,
       ta.nombre AS tipo_actividad_nombre,
       a.modalidad_trabajo AS actividad_modalidad,
       count(a.id) AS actividad_count
FROM tipo_actividad AS ta
LEFT JOIN actividad AS a ON a.tipo_actividad_id = ta.id
GROUP BY ta.id, ta.nombre, a.modalidad_trabajo
ORDER BY ta.id, a.modalidad_trabajo NULLS FIRST;
```

El recuento por actividad es opcional. Documente también resultados para `GRU`, `IND` y `NULL`; incluya cualquier otro valor que aparezca, no lo descarte. Use una ruta absoluta autorizada **fuera del repositorio**. Ejecute `\copy` desde esa misma sesión/transacción para exportar con la misma instantánea:

```text
\copy (SELECT id, nombre, modalidad_trabajo FROM tipo_actividad ORDER BY id) TO '/ruta/segura/legacy_tipo_actividad_modalidad_YYYYMMDD.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
```

`\copy` escribe el archivo en el equipo cliente. No use `COPY` del servidor. Compruebe permisos (`chmod 600 /ruta/segura/legacy_tipo_actividad_modalidad_YYYYMMDD.csv`) y que el destino tiene espacio suficiente; luego cierre la instantánea con `COMMIT;` (o `ROLLBACK;` si aborta). Nunca incluya el archivo ni una copia en el repositorio.

## Verificar y resguardar

1. Compare `total_tipos` con el recuento de registros que comunica `\copy` y valide el CSV con un lector CSV (no contando líneas: un nombre podría contener saltos de línea). Compruebe cabecera y columnas id, nombre y modalidad, incluidos valores nulos. No divulgue filas en el registro de operación.
2. Calcule y registre un checksum local, por ejemplo `sha256sum /ruta/segura/legacy_tipo_actividad_modalidad_YYYYMMDD.csv`. Guarde de forma segura el hash, fecha/hora, identidad de base/servidor, estado de migraciones, recuentos, responsable, ubicación protegida y plazo/política de retención. El hash no sustituye a la copia de seguridad.
3. Antes de ejecutar `0009`, obtenga una copia completa de la base según el procedimiento operativo y pruebe su restauración en un entorno aislado. No continúe si la copia o la restauración de prueba falla.
4. Conserve estos valores históricos por separado. Nunca convierta automáticamente `GRU` en `EQU`, ni sobrescriba `actividad.modalidad_trabajo`: son datos distintos y no existe una equivalencia uno-a-uno asumida.

## Límites y parada

En producción, `0009` y `0011` ya fueron aplicadas y la columna `tipo_actividad.modalidad_trabajo` no existe; `0012` no está aplicada. Por ello no se pueden exportar allí esos valores antiguos desde la tabla actual: solo sería posible recuperarlos de una copia anterior a `0009`, si existe y se restaura de forma aislada y autorizada. No intente recrear la columna ni inferir datos desde `actividad`.

Este documento no autoriza acceso o extracción de datos, no incluye automatización, no ejecuta `0009` ni `0012` y no contempla despliegues. Deténgase y escale al responsable de datos si la identidad, el historial, el esquema, el recuento, la integridad del archivo, la retención o la restauración no pueden verificarse.
