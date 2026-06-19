from django.urls import path
from .views import projects as projects_view
from .views import project_details as project_details_view
from .views import projects_overview as projects_overview_view

urlpatterns = [
    path("", projects_view, name="project"),
    # Listed before the UUID-detail route so "overview" is matched as a
    # literal segment rather than a project pk.
    path("overview/", projects_overview_view, name="projects-overview"),
    path("<uuid:pk>/", project_details_view, name="project-details"),
]