from django.conf import settings
from django.shortcuts import redirect
from django.views import View
from rest_framework.decorators import api_view, permission_classes, authentication_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework import status

from .serializers import CurrentUserSerializer, UpdateCurrentUserSerializer


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@authentication_classes([JWTAuthentication])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def me(request):
    user = request.user

    if request.method == "PATCH":
        serializer = UpdateCurrentUserSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.update(user, serializer.validated_data)

    return Response(CurrentUserSerializer(user, context={"request": request}).data, status=status.HTTP_200_OK)


class EmailConfirmationRedirectView(View):
    """
    Custom view to redirect email confirmation links to the frontend.

    This intercepts the django-allauth account-confirm-email/<key>/ URL
    and redirects to the React frontend with the key as a query parameter.

    Flow:
    1. User clicks link in email: http://localhost:8000/api/v1/auth/registration/account-confirm-email/<key>/
    2. This view redirects to: http://localhost:5173/verify-email?key=<key>
    3. Frontend extracts key and POSTs to: /api/v1/auth/registration/verify-email/
    4. Backend verifies email and returns success
    """

    def get(self, request, key, *args, **kwargs):
        """Redirect to frontend with verification key as query parameter"""
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        redirect_url = f"{frontend_url}/verify-email?key={key}"
        return redirect(redirect_url)
