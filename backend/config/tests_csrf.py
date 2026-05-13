"""
Comprehensive CSRF validation tests for the DRF SessionAuthentication flow.
"""
from django.test import TestCase, override_settings, Client
from django.conf import settings
from django.contrib.auth import get_user_model
from django.middleware.csrf import _get_new_csrf_string, _mask_cipher_secret

from rest_framework import status

from accounts.models import UserProfile

User = get_user_model()


class CSRFIntegrationTest(TestCase):
    """Test the complete CSRF flow: cookie → login → mutation"""

    def setUp(self):
        # Create admin user (post_save signal creates UserProfile with default DOCENTE)
        self.admin_user = User.objects.create_user(
            username="admin_test",
            password="pass1234!",
            is_staff=True,
        )
        self.admin_user.profile.role = UserProfile.Role.ADMIN
        self.admin_user.profile.save()

        # Create docente user
        self.docente_user = User.objects.create_user(
            username="docente_test",
            password="pass1234!",
        )
        self.docente_user.profile.refresh_from_db()

        self.client = Client(enforce_csrf_checks=True)

    def test_1_csrf_endpoint_sets_cookie(self):
        """GET /api/auth/csrf must set the csrftoken cookie"""
        response = self.client.get("/api/auth/csrf")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("csrftoken", response.cookies)
        token = response.cookies["csrftoken"].value
        self.assertTrue(len(token) > 0, "CSRF token should not be empty")

    def test_2_login_works_without_csrf_when_unauthenticated(self):
        """POST /api/auth/login can succeed without CSRF when unauthenticated
        (DRF SessionAuthentication only enforces CSRF for authenticated sessions).
        The frontend always calls GET /auth/csrf before login to prime the cookie."""
        self.client.cookies.clear()
        response = self.client.post(
            "/api/auth/login",
            {"username": "docente_test", "password": "pass1234!"},
            content_type="application/json",
        )
        # Login succeeds without CSRF when user is unauthenticated
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_3_login_with_csrf_succeeds(self):
        """POST /api/auth/login with CSRF should succeed"""
        # Step 1: GET csrf endpoint to get the token cookie
        csrf_response = self.client.get("/api/auth/csrf")
        csrf_token = csrf_response.cookies["csrftoken"].value

        # Step 2: POST login with X-CSRFToken header
        response = self.client.post(
            "/api/auth/login",
            {"username": "docente_test", "password": "pass1234!"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["username"], "docente_test")

    def test_4_logout_without_csrf_fails(self):
        """POST /api/auth/logout without CSRF must return 403 even when logged in"""
        # Login first with CSRF
        csrf_resp = self.client.get("/api/auth/csrf")
        token = csrf_resp.cookies["csrftoken"].value
        self.client.post(
            "/api/auth/login",
            {"username": "docente_test", "password": "pass1234!"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

        # Now try logout without CSRF
        self.client.cookies.pop("csrftoken", None)
        response = self.client.post("/api/auth/logout", content_type="application/json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_5_mutation_without_csrf_fails(self):
        """POST /api/competencias without CSRF must return 403"""
        # Login as admin
        csrf_resp = self.client.get("/api/auth/csrf")
        token = csrf_resp.cookies["csrftoken"].value
        self.client.post(
            "/api/auth/login",
            {"username": "admin_test", "password": "pass1234!"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

        # Try POST without CSRF
        self.client.cookies.pop("csrftoken", None)
        response = self.client.post(
            "/api/competencias",
            {"plan_estudio": 1, "codigo": "C1", "nombre": "Test"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_6_mutation_with_csrf_admin_succeeds(self):
        """Admin can POST /api/competencias with valid CSRF"""
        # Need a PlanEstudio first
        from academics.models import UnidadAcademica, Carrera, PlanEstudio

        ua = UnidadAcademica.objects.create(nombre="Facultad Test", sigla="FT")
        carrera = Carrera.objects.create(
            nombre="Ingeniería Test",
            codigo="IT",
            nivel=Carrera.DegreeLevel.GRADO,
            unidad_academica=ua,
        )
        plan = PlanEstudio.objects.create(
            carrera=carrera,
            nombre="Plan 2024",
            ordenanza="ORD-001",
            creditos=200,
            vigente_desde="2024-03-01",
        )

        # Login as admin
        csrf_resp = self.client.get("/api/auth/csrf")
        token = csrf_resp.cookies["csrftoken"].value
        self.client.post(
            "/api/auth/login",
            {"username": "admin_test", "password": "pass1234!"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

        # Get fresh CSRF token for mutation
        csrf_resp2 = self.client.get("/api/auth/csrf")
        token2 = csrf_resp2.cookies["csrftoken"].value

        # POST competencia with CSRF
        response = self.client.post(
            "/api/competencias",
            {"plan_estudio": plan.id, "codigo": "C1", "nombre": "Competencia Test"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token2,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["codigo"], "C1")

    def test_7_docente_mutation_blocked_by_permission(self):
        """Docente cannot POST /api/competencias (IsAdminProfile required)"""
        from academics.models import UnidadAcademica, Carrera, PlanEstudio

        ua = UnidadAcademica.objects.create(nombre="Facultad Test", sigla="FT")
        carrera = Carrera.objects.create(
            nombre="Ingeniería Test",
            codigo="IT",
            nivel=Carrera.DegreeLevel.GRADO,
            unidad_academica=ua,
        )
        plan = PlanEstudio.objects.create(
            carrera=carrera,
            nombre="Plan 2024",
            ordenanza="ORD-002",
            creditos=200,
            vigente_desde="2024-03-01",
        )

        # Login as docente
        csrf_resp = self.client.get("/api/auth/csrf")
        token = csrf_resp.cookies["csrftoken"].value
        self.client.post(
            "/api/auth/login",
            {"username": "docente_test", "password": "pass1234!"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

        # Get fresh CSRF
        csrf_resp2 = self.client.get("/api/auth/csrf")
        token2 = csrf_resp2.cookies["csrftoken"].value

        # Try creating competencia as docente
        response = self.client.post(
            "/api/competencias",
            {"plan_estudio": plan.id, "codigo": "C2", "nombre": "Docente test"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token2,
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_8_invalid_csrf_token_rejected(self):
        """POST with invalid/mismatched X-CSRFToken must fail"""
        # Login as admin
        csrf_resp = self.client.get("/api/auth/csrf")
        token = csrf_resp.cookies["csrftoken"].value
        self.client.post(
            "/api/auth/login",
            {"username": "admin_test", "password": "pass1234!"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

        # Send a deliberately invalid token
        response = self.client.post(
            "/api/auth/logout",
            content_type="application/json",
            HTTP_X_CSRFTOKEN="invalid-token-value",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
