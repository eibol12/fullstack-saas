from django.urls import path, include, re_path
from .views import me, EmailConfirmationRedirectView

urlpatterns = [
    path("me/", me, name="me"),
    path('', include('dj_rest_auth.urls')),

    # Custom email confirmation redirect (must come BEFORE dj_rest_auth.registration.urls)
    # This overrides the default TemplateView to redirect to frontend
    re_path(
        r'^registration/account-confirm-email/(?P<key>[-:\w]+)/$',
        EmailConfirmationRedirectView.as_view(),
        name='account_confirm_email',
    ),

    path('registration/', include('dj_rest_auth.registration.urls')),
]
