from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

from apps.main.selectors import ProjectSelector
from apps.main.services.projects import ProjectService
from apps.api.v1.projects.serializers import (
    ProjectSerializer,
    ProjectDetailSerializer,
    ProjectOverviewSerializer,
)
from apps.billing.permissions import CanCreateProject


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def projects_overview(request):
    """
    Centralized dashboard overview.

    Returns every project owned by the authenticated user with its
    analyses and per-analysis designs already nested in the payload,
    powering the projects table on `/dashboard`.
    """
    qs = ProjectSelector.get_dashboard_rows(request.user)
    serializer = ProjectOverviewSerializer(qs, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET', "POST"])
@permission_classes([IsAuthenticated, CanCreateProject])
def projects(request):
    if request.method == 'GET':
        qs = ProjectSelector.get_projects_for_user(request.user)
        serializer = ProjectSerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    serializer = ProjectSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    obj = ProjectService.create_project(
        owner=request.user,
        **serializer.validated_data
    )
    
    return Response(ProjectSerializer(obj).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def project_details(request, pk):
    if request.method == "PATCH":
        # First get the object to ensure ownership
        project = get_object_or_404(ProjectSelector.get_projects_for_user(request.user), pk=pk)
        
        serializer = ProjectSerializer(project, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        updated_project = ProjectService.update_project(
            project=project,
            **serializer.validated_data
        )
        
        return Response(ProjectSerializer(updated_project).data, status=status.HTTP_200_OK)

    if request.method == "DELETE":
        project = get_object_or_404(ProjectSelector.get_projects_for_user(request.user), pk=pk)
        ProjectService.delete_project(project)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # GET detail
    obj = get_object_or_404(ProjectSelector.get_project_detail_queryset(request.user), pk=pk)
    serializer = ProjectDetailSerializer(obj)
    return Response(serializer.data, status=status.HTTP_200_OK)