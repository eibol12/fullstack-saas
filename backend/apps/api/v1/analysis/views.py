from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from apps.main.models import LiftingAnalysis, Project
from apps.api.v1.analysis.serializers import LiftingAnalysisSerializer, LiftingAnalysisSummarySerializer
from apps.main.services.lifting import LiftingAnalysisService
from apps.billing.permissions import CanCreateAnalysis

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, CanCreateAnalysis])
def analyses(request):
    if request.method == "GET":
        #Filter by project_id if provided in query params, else return user analyses
        project_id = request.query_params.get('project_id')
        if project_id:
            qs = LiftingAnalysis.objects.filter(project__owner=request.user, project_id=project_id).select_related('project')
        else:
            qs = LiftingAnalysis.objects.filter(project__owner=request.user).select_related('project')
        serializer = LiftingAnalysisSummarySerializer(qs.order_by('-created_at'), many=True)
        return Response(serializer.data)

    #POST
    if request.method == "POST":
        #1 Validate incoming data structure using the Serializer
        # We pass the context so the serializer can access the project queryset if needed
        serializer = LiftingAnalysisSerializer(data = request.data)

        #This handles type conversion
        serializer.is_valid(raise_exception=True)

        #validated_data now contains clean types
        validated_data = serializer.validated_data
        config = validated_data.get("configuration")

        #Bridge to comply with legacy app expected data
        #Once legacy app is deprecated and DRF app is at MVP stage
        #this part and validation.py should be refactored.
        #TODO BRIDGE
        if "lifting_points_qty" not in config:
            config["lifting_points_qty"] = validated_data.get("lifting_points_qty")

        try:
            #2. Use Service to calculate results (DNV logic)
            #We extract configuration and other fields from validated_data
            analysis_data = LiftingAnalysisService.prepare_analysis_data(
                analysis_name=validated_data.get('name'),
                maximum_gross_weight=validated_data.get("maximum_gross_weight"),
                location=validated_data.get("location"),
                configuration=validated_data.get("configuration"),
            )

            #3 Retrieve and verify Project
            #Note: project_id comes from request.data as it's write_only in the serializer
            project_id = request.data.get("project_id")
            project = get_object_or_404(Project, id=project_id, owner = request.user)

            #4 Save to DB using the service
            # This ensures atomicity and final domain validation
            analysis_instance = LiftingAnalysisService.save_analysis_results(
                analysis_data=analysis_data,
                project=project,
                user=request.user
            )

            #5 Return the full saved object (including results and ID)
            #We re-serialize the "analysis_instance" we just created
            result_serializer = LiftingAnalysisSerializer(analysis_instance)
            return Response(result_serializer.data, status=status.HTTP_201_CREATED)

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({"error": f"Unexpected error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET","PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def analysis_details(request, pk):
    # 1. Ownership and Retrieval
    #We filter by project__owner to ensure the user only accesses their own analyses.
    base_qs = LiftingAnalysis.objects.filter(project__owner=request.user)
    analysis = get_object_or_404(base_qs, pk=pk)
    if request.method == "PATCH":
        #Validation and update
        serializer = LiftingAnalysisSerializer(analysis, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        #We use the service to handle the "Business Logic" of updating
        #which includes re-running DNV calculations if weights or geometry changed.

        #Map "name" from Serializer to "analysis_name" for the service
        #TODO BRIDGE
        updates = serializer.validated_data

        if "name" in updates:
            updates["analysis_name"] = updates.pop("name")

        try:
            updated_analysis = LiftingAnalysisService.update_analysis(
                analysis_id=pk,
                updates=serializer.validated_data,
                user=request.user
            )
            return Response(LiftingAnalysisSerializer(updated_analysis).data)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({})
    if request.method == "DELETE":
        LiftingAnalysisService.delete_analysis(
            analysis_id=pk,
            user=request.user
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
    #Returns the full detail analysis
    serializer = LiftingAnalysisSerializer(analysis)
    return Response(serializer.data)