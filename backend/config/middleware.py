from django.conf import settings
from django.http import HttpResponseForbidden, JsonResponse


class ProxyAccessMiddleware:
    LOCAL_HOSTS = {'localhost', '127.0.0.1'}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not getattr(settings, 'PROXY_ACCESS_SECRET', ''):
            return self.get_response(request)

        if self._is_exempt_path(request.path):
            return self.get_response(request)

        if self._has_valid_proxy_secret(request):
            return self.get_response(request)

        if self._is_local_request(request):
            return self.get_response(request)

        return self._blocked_response(request)

    def _is_exempt_path(self, path):
        return path in getattr(settings, 'PROXY_ACCESS_EXEMPT_PATHS', ())

    def _has_valid_proxy_secret(self, request):
        proxy_secret = getattr(settings, 'PROXY_ACCESS_SECRET', '')
        if not proxy_secret:
            return False
        return request.META.get('HTTP_X_PROXY_ACCESS_SECRET', '') == proxy_secret

    def _is_local_request(self, request):
        host = request.get_host().split(':', 1)[0]
        return host in self.LOCAL_HOSTS

    def _blocked_response(self, request):
        detail = 'Acceso directo al backend no permitido.'
        if request.path.startswith('/api/'):
            return JsonResponse({'detail': detail}, status=403)

        return HttpResponseForbidden(
            '<!doctype html>'
            '<html lang="es">'
            '<head><meta charset="utf-8"><title>Acceso restringido</title></head>'
            '<body><h1>Acceso restringido</h1>'
            '<p>Entrá usando el dominio principal de la aplicación.</p></body>'
            '</html>'
        )
