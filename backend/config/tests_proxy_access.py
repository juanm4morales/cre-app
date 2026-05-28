from django.test import TestCase, override_settings


@override_settings(
    PROXY_ACCESS_SECRET='shared-secret',
    PROXY_ACCESS_EXEMPT_PATHS=('/healthz',),
)
class ProxyAccessMiddlewareTest(TestCase):
    def test_healthz_is_exempt(self):
        response = self.client.get('/healthz')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b'ok')

    def test_api_request_without_proxy_secret_is_blocked(self):
        response = self.client.get('/api/auth/csrf')

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['detail'], 'Acceso directo al backend no permitido.')

    def test_api_request_with_valid_proxy_secret_is_allowed(self):
        response = self.client.get(
            '/api/auth/csrf',
            HTTP_X_PROXY_ACCESS_SECRET='shared-secret',
        )

        self.assertEqual(response.status_code, 200)

    def test_admin_request_without_proxy_secret_is_blocked(self):
        response = self.client.get('/django-admin/')

        self.assertEqual(response.status_code, 403)
        self.assertIn('Acceso restringido', response.content.decode())
