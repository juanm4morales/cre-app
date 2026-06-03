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
from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.views.static import serve

urlpatterns = [
    path('healthz', lambda request: HttpResponse('ok', content_type='text/plain'), name='healthz'),
    path('api/sadmin-creapp-panel/', admin.site.urls),
    re_path(r'^api/static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT}),
    path('api/', include('config.api_urls')),
    re_path(r'^.*$', TemplateView.as_view(template_name='index.html')),
]
