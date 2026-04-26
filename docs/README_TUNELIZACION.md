# README de Tunelizacion

Guia practica para compartir CRE App por internet usando Cloudflare Tunnel (`cloudflared`) en Arch Linux.

Esta guia esta pensada para el estado actual del proyecto:

- Frontend React con Vite en puerto `5173`
- Backend Django en puerto `8000`
- Proxy de Vite hacia `/api`, `/admin` y `/accounts`

## Objetivo

Exponer la aplicacion a traves de una URL publica temporal de `trycloudflare.com` para que otra persona pueda probarla sin desplegar infraestructura.

## Requisitos

Antes de abrir el tunel, tienen que estar corriendo:

1. El backend Django
2. El frontend Vite
3. El binario `cloudflared`

## Instalacion de cloudflared en Arch Linux sin sudo

Esta fue la estrategia usada en este repo para evitar depender del sistema global.

```sh
mkdir -p ~/.local/bin
curl -fL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" -o ~/.local/bin/cloudflared
chmod +x ~/.local/bin/cloudflared
~/.local/bin/cloudflared --version
```

Si tu arquitectura no es `x86_64`, ajusta el binario descargado.

Verificacion rapida:

```sh
uname -m
~/.local/bin/cloudflared --version
```

## Como levantar la aplicacion

### 1. Backend Django

```sh
cd /home/juanm4/Dev/cre-app/backend
/home/juanm4/Dev/cre-app/.venv/bin/python manage.py runserver
```

### 2. Frontend Vite

```sh
cd /home/juanm4/Dev/cre-app/frontend
npm run dev
```

### 3. Tunnel de Cloudflare

```sh
cd /home/juanm4/Dev/cre-app
~/.local/bin/cloudflared tunnel --no-autoupdate --url http://localhost:5173 --http-host-header localhost:5173
```

## Por que se usa localhost y http-host-header

En este proyecto no alcanzo con apuntar el tunel a `127.0.0.1:5173`.

Problemas observados:

1. `127.0.0.1:5173` devolvia `connection refused`
2. `localhost:5173` sin header adicional devolvia `403`

Configuracion que funciono:

```sh
~/.local/bin/cloudflared tunnel --no-autoupdate --url http://localhost:5173 --http-host-header localhost:5173
```

Ese `--http-host-header localhost:5173` fuerza un host aceptado por el servidor de desarrollo de Vite.

## URL publica

Cuando `cloudflared` arranca correctamente, imprime una URL similar a esta:

```text
https://xxxxx.trycloudflare.com
```

Esa es la URL que compartis.

Importante:

1. La URL cambia cada vez que levantas un quick tunnel.
2. La URL dura mientras el proceso de `cloudflared` siga vivo.
3. Si cerras frontend, backend o tunnel, la app deja de funcionar para terceros.

## Como cancelar el tunel

### Opcion 1: desde la terminal activa

Presiona `Ctrl+C` en la terminal donde corre `cloudflared`.

### Opcion 2: desde otra terminal

Buscar el proceso:

```sh
pgrep -af cloudflared
```

Matar por PID:

```sh
kill PID
```

O matar todos los quick tunnels:

```sh
pkill -f "cloudflared tunnel"
```

## Verificaciones utiles

### Ver si frontend y backend estan escuchando

```sh
ss -ltnp '( sport = :5173 )'
ss -ltnp '( sport = :8000 )'
```

### Ver si cloudflared esta instalado

```sh
command -v cloudflared
~/.local/bin/cloudflared --version
```

### Ver si Vite y Django siguen corriendo

```sh
ps -eo pid,ppid,cmd | grep -Ei 'vite|npm run dev|manage.py runserver' | grep -v grep
```

## Troubleshooting

### 1. La URL publica responde 502

Posibles causas:

1. El frontend no esta corriendo
2. `cloudflared` apunta al host incorrecto
3. Vite no acepta la conexion al host local usado

Accion recomendada:

```sh
~/.local/bin/cloudflared tunnel --no-autoupdate --url http://localhost:5173 --http-host-header localhost:5173
```

### 2. La URL publica responde 403

Eso puede venir del dev server de Vite por host header no permitido.

Usar:

```sh
--http-host-header localhost:5173
```

### 3. El login no funciona desde la URL publica

Verificar que:

1. El backend siga corriendo en `8000`
2. El frontend este corriendo en `5173`
3. El proxy de Vite siga configurado en [frontend/vite.config.js](/home/juanm4/Dev/cre-app/frontend/vite.config.js)

### 4. El tunel funciona pero luego deja de responder

Los quick tunnels de `trycloudflare.com` no son un entorno estable de produccion. Sirven para demos, validaciones puntuales y revisiones rapidas.

## Flujo minimo recomendado

Abrir tres terminales:

### Terminal 1

```sh
cd /home/juanm4/Dev/cre-app/backend
/home/juanm4/Dev/cre-app/.venv/bin/python manage.py runserver
```

### Terminal 2

```sh
cd /home/juanm4/Dev/cre-app/frontend
npm run dev
```

### Terminal 3

```sh
cd /home/juanm4/Dev/cre-app
~/.local/bin/cloudflared tunnel --no-autoupdate --url http://localhost:5173 --http-host-header localhost:5173
```

## Que se hizo en este repo

Para dejar la tunelizacion funcional, se verifico y ajusto lo siguiente:

1. El frontend Vite corre en `5173`
2. El backend Django corre en `8000`
3. Vite proxyea `/api`, `/admin` y `/accounts` al backend en [frontend/vite.config.js](/home/juanm4/Dev/cre-app/frontend/vite.config.js)
4. `cloudflared` se instalo en `~/.local/bin/cloudflared`
5. Se valido que la URL publica cargara correctamente la pantalla de login

## Limitaciones actuales

1. La URL es temporal
2. No hay dominio propio
3. No hay persistencia del tunel como servicio
4. Sigue siendo un entorno de desarrollo, no un despliegue productivo

## Siguiente paso recomendado

Si queres compartirlo con mas estabilidad, conviene migrar a un named tunnel de Cloudflare con una URL fija y ejecutar frontend/backend de una forma menos dependiente del modo desarrollo.