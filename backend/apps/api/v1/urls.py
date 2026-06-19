from django.urls import path, include

urlpatterns = [
    path("auth/", include('apps.api.v1.auth.urls')),
    path("design/", include('apps.api.v1.design.urls')),
    path("analysis/", include('apps.api.v1.analysis.urls')),
    path("projects/", include('apps.api.v1.projects.urls')),
    path("billing/", include('apps.api.v1.billing.urls')),
    path("health/", include('apps.api.v1.health.urls')),
]