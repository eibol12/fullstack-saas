from django.urls import path
from .views import analyses as analyses_view
from .views import analysis_details as analysis_details_view


urlpatterns = [
    path("", analyses_view ,name="analyses"),
    path("<uuid:pk>/", analysis_details_view ,name="analysis-details"),
]