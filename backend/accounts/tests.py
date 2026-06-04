"""
Unit and integration tests for accounts app:
- LoginSerializer, UserCreateSerializer, UserUpdateSerializer
- Auth endpoints (me)
- UserViewSet CRUD + permissions
- Password validation gap detection (QA)
"""
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from rest_framework import status

from accounts.models import UserProfile
from accounts.serializers import (
    LoginSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    UserSerializer,
)

User = get_user_model()


# ═══════════════════════════════════════════════
#  UNIT TESTS — Serializers
# ═══════════════════════════════════════════════

class LoginSerializerTest(TestCase):
    """LoginSerializer: username/email login, inactive user, invalid credentials."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="logintest",
            password="StrongPass1!",
            email="logintest@example.com",
            first_name="Login",
            last_name="Test",
        )

    def test_login_with_username_succeeds(self):
        serializer = LoginSerializer(data={
            "username": "logintest",
            "password": "StrongPass1!",
        })
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data["user"], self.user)

    def test_login_with_email_succeeds(self):
        serializer = LoginSerializer(data={
            "username": "logintest@example.com",
            "password": "StrongPass1!",
        })
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data["user"], self.user)

    def test_login_inactive_user_fails(self):
        self.user.is_active = False
        self.user.save()
        serializer = LoginSerializer(data={
            "username": "logintest",
            "password": "StrongPass1!",
        })
        self.assertFalse(serializer.is_valid())

    def test_login_invalid_credentials_fails(self):
        serializer = LoginSerializer(data={
            "username": "logintest",
            "password": "wrongpass",
        })
        self.assertFalse(serializer.is_valid())

    def test_login_missing_fields_fails(self):
        serializer = LoginSerializer(data={})
        self.assertFalse(serializer.is_valid())

    def test_login_nonexistent_user_fails(self):
        serializer = LoginSerializer(data={
            "username": "ghost",
            "password": "StrongPass1!",
        })
        self.assertFalse(serializer.is_valid())


class UserCreateSerializerTest(TestCase):
    """UserCreateSerializer: hashed password, default DOCENTE role."""

    def test_creates_user_with_hashed_password(self):
        serializer = UserCreateSerializer(data={
            "username": "newdocente1",
            "password": "StrongPass1!",
            "first_name": "New",
            "last_name": "Docente",
            "email": "new1@example.com",
        })
        self.assertTrue(serializer.is_valid())
        user = serializer.save()
        self.assertTrue(user.check_password("StrongPass1!"))
        self.assertNotEqual(user.password, "StrongPass1!")

    def test_default_role_is_docente(self):
        serializer = UserCreateSerializer(data={
            "username": "newdocente2",
            "password": "StrongPass1!",
        })
        self.assertTrue(serializer.is_valid())
        user = serializer.save()
        self.assertEqual(user.profile.role, "DOCENTE")

    def test_create_missing_password_fails(self):
        serializer = UserCreateSerializer(data={
            "username": "nopassuser",
        })
        self.assertFalse(serializer.is_valid())


class UserUpdateSerializerTest(TestCase):
    """UserUpdateSerializer: field update, password change."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="updateuser",
            password="StrongPass1!",
        )

    def test_update_basic_fields(self):
        serializer = UserUpdateSerializer(
            instance=self.user,
            data={
                "first_name": "Updated",
                "last_name": "Name",
                "email": "updated@example.com",
            },
            partial=True,
        )
        self.assertTrue(serializer.is_valid())
        updated = serializer.save()
        self.assertEqual(updated.first_name, "Updated")
        self.assertEqual(updated.last_name, "Name")
        self.assertEqual(updated.email, "updated@example.com")

    def test_update_password(self):
        serializer = UserUpdateSerializer(
            instance=self.user,
            data={"password": "NewStrongPass1!"},
            partial=True,
        )
        self.assertTrue(serializer.is_valid())
        updated = serializer.save()
        self.assertTrue(updated.check_password("NewStrongPass1!"))

    def test_update_is_active(self):
        self.assertTrue(self.user.is_active)
        serializer = UserUpdateSerializer(
            instance=self.user,
            data={"is_active": False},
            partial=True,
        )
        self.assertTrue(serializer.is_valid())
        serializer.save()
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)


# ═══════════════════════════════════════════════
#  QA GAP DETECTION — Password validation
# ═══════════════════════════════════════════════

class PasswordValidationGapTest(TestCase):
    """
    QA: Detect whether password validators are enforced on API serializers.

    Django has password validators configured (MinimumLengthValidator,
    CommonPasswordValidator, etc.) but UserCreateSerializer and
    UserUpdateSerializer do NOT call validate_password.

    These tests EXPECT weak passwords to be REJECTED.
    If they fail, the app has a security gap.
    """

    def test_create_user_with_weak_password_is_not_rejected(self):
        """
        EXPECTED: weak password '123' should be rejected by the serializer.
        If this test FAILS (assertFalse passes when is_valid is True),
        it means the API accepts insecure passwords → SECURITY GAP.
        """
        weak_password = "123"
        serializer = UserCreateSerializer(data={
            "username": "weakpasscreate",
            "password": weak_password,
        })
        is_valid = serializer.is_valid()
        self.assertFalse(
            is_valid,
            "SECURITY GAP: UserCreateSerializer accepts weak password '123'. "
            "Django password validators are configured but not enforced.",
        )

    def test_update_user_with_weak_password_is_not_rejected(self):
        """
        EXPECTED: weak password '123' should be rejected even on update.
        """
        user = User.objects.create_user(
            username="weakpassupdate",
            password="StrongPass1!",
        )
        weak_password = "123"
        serializer = UserUpdateSerializer(
            instance=user,
            data={"password": weak_password},
            partial=True,
        )
        is_valid = serializer.is_valid()
        self.assertFalse(
            is_valid,
            "SECURITY GAP: UserUpdateSerializer accepts weak password '123' on update. "
            "Django password validators are configured but not enforced.",
        )


# ═══════════════════════════════════════════════
#  INTEGRATION TESTS — Auth endpoints
# ═══════════════════════════════════════════════

class MeEndpointTest(TestCase):
    """Integration tests for GET /api/auth/me."""

    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.user = User.objects.create_user(
            username="metest",
            password="StrongPass1!",
            first_name="Me",
            last_name="Test",
        )

    def _login(self, role=None):
        csrf_resp = self.client.get("/api/auth/csrf")
        token = csrf_resp.cookies["csrftoken"].value
        payload = {"username": "metest", "password": "StrongPass1!"}
        if role:
            payload["role"] = role
        return self.client.post(
            "/api/auth/login",
            payload,
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

    def test_me_requires_authentication(self):
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_me_returns_user_data_when_authenticated(self):
        self._login()
        response = self.client.get("/api/auth/me")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["username"], "metest")
        self.assertEqual(data["name"], "Me Test")
        self.assertIn("role", data)
        self.assertIn("csrfToken", data)
        self.assertTrue(data["csrfToken"])
        self.assertEqual(data["available_roles"], ["docente"])

    def test_me_role_is_docente_by_default(self):
        self._login()
        response = self.client.get("/api/auth/me")
        data = response.json()
        self.assertEqual(data["role"], "docente")

    def test_me_role_is_admin_for_admin_user(self):
        self.user.profile.role = UserProfile.Role.ADMIN
        self.user.profile.save()
        self._login()
        response = self.client.get("/api/auth/me")
        data = response.json()
        self.assertEqual(data["role"], "admin")

    def test_me_role_is_admin_for_staff_docente_user(self):
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        self.user.profile.role = UserProfile.Role.DOCENTE
        self.user.profile.save(update_fields=["role"])
        self._login()
        response = self.client.get("/api/auth/me")
        data = response.json()
        self.assertEqual(data["role"], "admin")
        self.assertEqual(data["available_roles"], ["admin", "docente"])

    def test_login_can_select_docente_role_for_staff_docente_user(self):
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        self.user.profile.role = UserProfile.Role.DOCENTE
        self.user.profile.save(update_fields=["role"])

        response = self._login(role="docente")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["role"], "docente")
        self.assertIn("csrfToken", data)
        self.assertTrue(data["csrfToken"])
        self.assertEqual(data["available_roles"], ["admin", "docente"])

    def test_login_rejects_unavailable_role(self):
        response = self._login(role="admin")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("No tenes permisos para ingresar como admin.", str(response.json()))

    def test_switch_role_updates_active_role(self):
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        self.user.profile.role = UserProfile.Role.DOCENTE
        self.user.profile.save(update_fields=["role"])
        self._login(role="docente")

        token = self.client.get("/api/auth/csrf").json()["csrfToken"]
        response = self.client.post(
            "/api/auth/role",
            {"role": "admin"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["role"], "admin")

        me_response = self.client.get("/api/auth/me")
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.json()["role"], "admin")


# ═══════════════════════════════════════════════
#  INTEGRATION TESTS — UserViewSet CRUD + permissions
# ═══════════════════════════════════════════════

class UserViewSetIntegrationTest(TestCase):
    """UserViewSet: CRUD, role-based access, soft-delete."""

    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)

        # Admin user
        self.admin = User.objects.create_user(
            username="admin_user",
            password="AdminPass1!",
            is_staff=True,
        )
        self.admin.profile.role = UserProfile.Role.ADMIN
        self.admin.profile.save()

        # Docente user
        self.docente = User.objects.create_user(
            username="docente_user",
            password="DocentePass1!",
            first_name="Docente",
            last_name="User",
            email="docente@example.com",
        )

        # Superuser (should be excluded from admin lists)
        self.superuser = User.objects.create_superuser(
            username="super_admin",
            password="SuperPass1!",
        )

    def _login_as_admin(self):
        csrf_resp = self.client.get("/api/auth/csrf")
        token = csrf_resp.cookies["csrftoken"].value
        self.client.post(
            "/api/auth/login",
            {"username": "admin_user", "password": "AdminPass1!"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )

    def _get_csrf_token(self):
        resp = self.client.get("/api/auth/csrf")
        return resp.cookies["csrftoken"].value

    def test_list_requires_admin(self):
        # Login as docente
        csrf_resp = self.client.get("/api/auth/csrf")
        token = csrf_resp.cookies["csrftoken"].value
        self.client.post(
            "/api/auth/login",
            {"username": "docente_user", "password": "DocentePass1!"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        response = self.client.get("/api/usuarios")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_list_users(self):
        self._login_as_admin()
        response = self.client.get("/api/usuarios")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = [u["username"] for u in response.json()["results"]]
        self.assertIn("docente_user", usernames)

    def test_admin_list_excludes_superuser(self):
        self._login_as_admin()
        response = self.client.get("/api/usuarios")
        usernames = [u["username"] for u in response.json()["results"]]
        self.assertNotIn("super_admin", usernames)
        self.assertNotIn("admin_user", usernames)

    def test_admin_can_create_user(self):
        self._login_as_admin()
        token = self._get_csrf_token()
        response = self.client.post(
            "/api/usuarios",
            {
                "username": "nuevodocente",
                "password": "StrongPass1!",
                "first_name": "Nuevo",
                "last_name": "Docente",
                "email": "nuevo@example.com",
            },
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="nuevodocente").exists())
        created = User.objects.get(username="nuevodocente")
        self.assertEqual(created.profile.role, "DOCENTE")

    def test_admin_can_update_user(self):
        self._login_as_admin()
        token = self._get_csrf_token()
        response = self.client.patch(
            f"/api/usuarios/{self.docente.id}",
            {"first_name": "UpdatedFirst"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.docente.refresh_from_db()
        self.assertEqual(self.docente.first_name, "UpdatedFirst")

    def test_admin_can_soft_delete_user(self):
        self._login_as_admin()
        token = self._get_csrf_token()
        self.assertTrue(self.docente.is_active)
        response = self.client.delete(
            f"/api/usuarios/{self.docente.id}",
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.docente.refresh_from_db()
        self.assertFalse(self.docente.is_active)

    def test_create_requires_admin(self):
        # Login as docente
        csrf_resp = self.client.get("/api/auth/csrf")
        token = csrf_resp.cookies["csrftoken"].value
        self.client.post(
            "/api/auth/login",
            {"username": "docente_user", "password": "DocentePass1!"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        token2 = self._get_csrf_token()
        response = self.client.post(
            "/api/usuarios",
            {"username": "shouldfail", "password": "StrongPass1!"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token2,
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_destroy_requires_admin(self):
        self._login_as_admin()
        token = self._get_csrf_token()
        # Logout admin
        self.client.post("/api/auth/logout", content_type="application/json", HTTP_X_CSRFTOKEN=token)
        # Login as docente
        csrf_resp = self.client.get("/api/auth/csrf")
        token2 = csrf_resp.cookies["csrftoken"].value
        self.client.post(
            "/api/auth/login",
            {"username": "docente_user", "password": "DocentePass1!"},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token2,
        )
        token3 = self._get_csrf_token()
        # Try to delete another user
        other_docente = User.objects.create_user(username="otherdocente", password="Pass1234!")
        response = self.client.delete(
            f"/api/usuarios/{other_docente.id}",
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token3,
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
