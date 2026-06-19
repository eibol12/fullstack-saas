# apps/api/v1/health/views.py
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({"status": "ok"}, status=200)