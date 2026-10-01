#!/usr/bin/env python3
"""HTTPS smoke probe for the disposable same-origin Compose stack."""

from __future__ import annotations

import http.client
import json
import os
import re
import socket
import ssl
import sys
import time
from http.cookies import SimpleCookie
from urllib.parse import urlsplit


class LoopbackVerifiedHTTPSConnection(http.client.HTTPSConnection):
    """Connect to loopback while TLS verifies the requested creapp.test name."""

    def connect(self):
        raw_socket = socket.create_connection(
            ("127.0.0.1", self.port), self.timeout, self.source_address
        )
        self.sock = self._context.wrap_socket(raw_socket, server_hostname=self.host)


def fail(message: str) -> None:
    raise AssertionError(message)


def is_django_admin_html(status: int, content_type: str, body: bytes) -> bool:
    return (
        status == 200
        and "text/html" in content_type.lower()
        and b'id="site-name"' in body
    )


def main() -> None:
    base_url = os.environ["BASE_URL"]
    ca_file = os.environ["CA_FILE"]
    username = os.environ["TEST_ADMIN_USERNAME"]
    password = os.environ["TEST_ADMIN_PASSWORD"]
    parsed = urlsplit(base_url)
    if parsed.scheme != "https" or parsed.hostname != "creapp.test" or not parsed.port:
        fail("BASE_URL debe usar https://creapp.test:<puerto>")

    context = ssl.create_default_context(cafile=ca_file)
    if not context.check_hostname or context.verify_mode != ssl.CERT_REQUIRED:
        fail("El contexto TLS debe validar CA y hostname")
    cookies: dict[str, str] = {}
    cookie_flags: dict[str, dict[str, bool]] = {}

    def request(method: str, path: str, payload=None, csrf: str | None = None):
        conn = LoopbackVerifiedHTTPSConnection(
            "creapp.test", parsed.port, context=context, timeout=8
        )
        headers = {
            "Accept": "application/json, text/html, */*",
            "Host": f"creapp.test:{parsed.port}",
            "Origin": f"https://creapp.test:{parsed.port}",
        }
        if cookies:
            headers["Cookie"] = "; ".join(f"{key}={value}" for key, value in cookies.items())
        body = None
        if payload is not None:
            body = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if csrf:
            headers["X-CSRFToken"] = csrf

        conn.request(method, path, body=body, headers=headers)
        response = conn.getresponse()
        response_body = response.read()
        response_headers = {key.lower(): value for key, value in response.getheaders()}
        for raw_cookie in response.headers.get_all("Set-Cookie", []):
            parsed_cookie = SimpleCookie()
            parsed_cookie.load(raw_cookie)
            for key, morsel in parsed_cookie.items():
                cookies[key] = morsel.value
                cookie_flags[key] = {
                    "secure": bool(morsel["secure"]),
                    "httponly": bool(morsel["httponly"]),
                }
        status = response.status
        conn.close()
        return status, response_headers, response_body

    deadline = time.monotonic() + 90
    while True:
        try:
            status, headers, body = request("GET", "/healthz")
            if status == 200 and body == b"ok" and headers.get("content-type", "").startswith("text/plain"):
                break
            fail(f"/healthz inesperado: status={status}, content-type={headers.get('content-type')}")
        except (OSError, ssl.SSLError):
            if time.monotonic() >= deadline:
                raise
            time.sleep(2)

    print("PASS HTTPS trusted-CA + hostname creapp.test; /healthz 200 text/plain ok")

    status, headers, body = request("GET", "/")
    if status != 200 or not headers.get("content-type", "").startswith("text/html"):
        fail("/ no sirvió HTML de SPA")
    html = body.decode("utf-8", errors="replace")
    if 'id="root"' not in html:
        fail("index.html no contiene el contenedor SPA esperado")
    print("PASS raíz SPA / devuelve HTML")

    status, headers, body = request("GET", "/docente/agenda-cursado")
    if status != 200 or not headers.get("content-type", "").startswith("text/html"):
        fail("La ruta profunda SPA no devuelve index.html")
    print("PASS ruta profunda SPA devuelve HTML")

    status, headers, body = request("GET", "/api")
    if status != 308 or headers.get("location") != "/api/":
        fail(f"/api debe redirigir exactamente a /api/: {status}, {headers.get('location')}")
    print("PASS /api -> 308 /api/ (sin fallback HTML)")

    script_match = re.search(r'<script[^>]+src="([^"]+\.js)"', html)
    if not script_match:
        fail("No se encontró bundle JavaScript en index.html")
    asset_path = urlsplit(script_match.group(1)).path
    if not asset_path.startswith("/api/static/"):
        fail(f"Bundle no usa /api/static/: {asset_path}")
    status, headers, body = request("GET", asset_path)
    if status != 200 or len(body) == 0:
        fail(f"Bundle no se sirve: {status}, bytes={len(body)}")
    if "javascript" not in headers.get("content-type", "").lower():
        fail(f"Content-Type JS inesperado: {headers.get('content-type')}")
    print(f"PASS asset {asset_path}: 200, {len(body)} bytes, {headers.get('content-type')}")
    stylesheet = re.search(r'<link[^>]+href="([^"]+\.css)"', html)
    if stylesheet:
        css_path = urlsplit(stylesheet.group(1)).path
        if not css_path.startswith("/api/static/"):
            fail(f"CSS no usa /api/static/: {css_path}")
        status, headers, body = request("GET", css_path)
        if status != 200 or not body or "text/css" not in headers.get("content-type", "").lower():
            fail(f"CSS no se sirve correctamente: HTTP {status}, bytes={len(body)}")
        print(f"PASS asset {css_path}: 200, {len(body)} bytes, {headers.get('content-type')}")

    status, headers, body = request("GET", "/api/auth/csrf")
    if status != 200 or "json" not in headers.get("content-type", "").lower():
        fail("/api/auth/csrf no devuelve JSON 200")
    csrf_payload = json.loads(body)
    csrf_token = csrf_payload.get("csrfToken")
    if not csrf_token or "csrftoken" not in cookies:
        fail("Falta csrfToken JSON o cookie csrftoken")
    status, headers, body = request(
        "POST",
        "/api/auth/login",
        {"username": username, "password": password},
        csrf=csrf_token,
    )
    if status != 200:
        fail(f"Login falló: HTTP {status}; respuesta={body[:300]!r}")
    login_payload = json.loads(body)
    csrf_token = login_payload.get("csrfToken")
    if not csrf_token or "sessionid" not in cookies:
        fail("Login no creó sesión/token CSRF JSON")
    if not cookie_flags.get("sessionid", {}).get("secure") or not cookie_flags.get("csrftoken", {}).get("secure"):
        fail("Cookies de sesión y CSRF deben llevar Secure bajo HTTPS")
    if "admin" not in login_payload.get("available_roles", []):
        fail("La cuenta efímera de smoke no dispone del rol admin")
    print("PASS auth CSRF JSON + cookie de sesión Secure")

    status, headers, body = request("GET", "/api/auth/me")
    if status != 200 or json.loads(body).get("username") != username:
        fail("/api/auth/me no confirmó la sesión")
    status, headers, body = request("GET", "/api/sadmin-creapp-panel/")
    if not is_django_admin_html(status, headers.get("content-type", ""), body):
        fail(f"Django Admin no devolvió su marcador HTML esperado: HTTP {status}")
    print("PASS sesión /auth/me y Django Admin detrás de /api/")

    sigla = "Q" + os.urandom(4).hex().upper()
    payload = {"nombre": f"Harness {sigla}", "sigla": sigla}
    status, headers, body = request("POST", "/api/unidades-academicas", payload, csrf=csrf_token)
    if status != 201:
        fail(f"POST autenticado con CSRF falló: HTTP {status}; respuesta={body[:300]!r}")
    created = json.loads(body)
    if created.get("sigla") != sigla:
        fail("La API no devolvió el registro creado esperado")
    status, headers, body = request("GET", "/api/unidades-academicas")
    if status != 200 or not any(row.get("sigla") == sigla for row in json.loads(body).get("results", [])):
        fail("GET API no leyó el registro persistido en PostgreSQL")
    print("PASS POST/GET autenticado con CSRF y lectura persistente PostgreSQL")

    status, headers, body = request("POST", "/api/auth/logout", {}, csrf=csrf_token)
    if status != 200:
        fail(f"Logout falló: HTTP {status}")
    status, headers, body = request("GET", "/api/auth/me")
    if status not in (401, 403):
        fail(f"La sesión siguió autenticada tras logout: HTTP {status}")
    print("PASS logout invalida la sesión")


if __name__ == "__main__":
    main()
