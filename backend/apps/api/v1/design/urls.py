from django.urls import path
from .views import designs, design_details, design_report, component_options

urlpatterns = [
    path("", designs, name="design"),
    path("<uuid:pk>/", design_details, name="design-details"),
    path("<uuid:pk>/report/", design_report, name="design-report"),
    path("component-options/", component_options, name="component-options"),
]
