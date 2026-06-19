from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from apps.main.models import RiggingDesign, LiftingAnalysis
from apps.api.v1.design.serializers import (
    RiggingDesignSerializer,
    RiggingDesignSummarySerializer,
    CreateRiggingDesignSerializer,
    UpdateRiggingDesignSerializer,
)
from apps.main.services.rigging import RiggingDesignService
from apps.main.services.rigging_report_preview import RiggingDesignReportPreviewService
from domain.rigging.errors import (
    ComponentNotFoundError,
)
from apps.billing.permissions import CanCreateDesign, CanExportPDF


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, CanCreateDesign])
def designs(request):
    """
    GET: List rigging designs with optional filtering by analysis_id or project_id
    POST: Create a new rigging design from an existing analysis
    """
    if request.method == "GET":
        # Base queryset: user's designs only
        qs = RiggingDesign.objects.filter(
            project__owner=request.user
        ).select_related('analysis', 'project')

        # Filter by analysis_id if provided
        analysis_id = request.query_params.get('analysis_id')
        if analysis_id:
            qs = qs.filter(analysis_id=analysis_id)

        # Filter by project_id if provided
        project_id = request.query_params.get('project_id')
        if project_id:
            qs = qs.filter(project_id=project_id)

        # Order by most recent
        qs = qs.order_by('-created_at')

        # Serialize and return
        serializer = RiggingDesignSummarySerializer(qs, many=True)
        return Response(serializer.data)

    # POST: Create new design
    if request.method == "POST":
        # Validate incoming data
        serializer = CreateRiggingDesignSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        validated_data = serializer.validated_data
        analysis_id = validated_data.get('analysis_id')
        name = validated_data.get('name', '')
        set_active = validated_data.get('set_active', False)
        user_preferences = validated_data.get('user_preferences')

        try:
            # Call service to run design computation and persist
            design = RiggingDesignService.run_design_for_analysis(
                analysis_id=analysis_id,
                user_preferences=user_preferences,
                name=name,
                set_active=set_active,
                user=request.user,
            )

            # Return full design details
            result_serializer = RiggingDesignSerializer(design)
            return Response(result_serializer.data, status=status.HTTP_201_CREATED)

        except ComponentNotFoundError as e:
            raise NotFound(str(e)) from e
        except ValueError as e:
            raise ValidationError({"non_field_errors": [str(e)]}) from e


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def design_details(request, pk):
    """
    GET: Retrieve full design details with enriched results
    PATCH: Update design (name, status, activation)
    DELETE: Delete design
    """
    # Ensure user owns the design
    base_qs = RiggingDesign.objects.filter(project__owner=request.user)
    design = get_object_or_404(base_qs.select_related('analysis', 'project'), pk=pk)

    if request.method == "GET":
        # Build enriched results using service
        try:
            enriched_results = RiggingDesignService.build_detail_results(design)
        except ValueError:
            serializer = RiggingDesignSerializer(design)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {"error": f"Error building design details: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Serialize design
        serializer = RiggingDesignSerializer(design)
        data = serializer.data

        # Replace results with enriched version
        data['results'] = enriched_results

        return Response(data)

    if request.method == "PATCH":
        # Validate update data
        serializer = UpdateRiggingDesignSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        validated_data = serializer.validated_data

        # Handle activation specially (deactivate siblings)
        if 'is_active' in validated_data and validated_data['is_active']:
            try:
                design = RiggingDesignService.activate_design(design.id, user=request.user)
            except Exception as e:
                return Response(
                    {"error": f"Failed to activate design: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        # In-place recompute when engineering inputs change (Step 3 of the
        # engineer-UX refactor). We keep the same row, FKs and version; only
        # `arrangement`/`results` are overwritten.
        if 'user_preferences' in validated_data:
            try:
                design = RiggingDesignService.recompute_design(
                    design=design,
                    user_preferences=validated_data.get('user_preferences'),
                    name=validated_data.get('name'),
                    status=validated_data.get('status'),
                )
            except ComponentNotFoundError as e:
                raise NotFound(str(e)) from e
            except ValueError as e:
                raise ValidationError({"non_field_errors": [str(e)]}) from e
        else:
            # Metadata-only PATCH (name/status). is_active is already handled above.
            if 'name' in validated_data:
                design.name = validated_data['name']
            if 'status' in validated_data:
                design.status = validated_data['status']
            design.save()

        # Return updated design
        result_serializer = RiggingDesignSerializer(design)
        return Response(result_serializer.data)

    if request.method == "DELETE":
        try:
            RiggingDesignService.delete_design(design.id, user=request.user)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response(
                {"error": f"Failed to delete design: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(["GET"])
@permission_classes([IsAuthenticated, CanExportPDF])
def design_report(request, pk):
    """
    GET: Return a report-specific payload for the editorial report preview page.
    """
    base_qs = RiggingDesign.objects.filter(project__owner=request.user)
    design = get_object_or_404(base_qs.select_related("analysis", "project", "project__owner"), pk=pk)
    selected_key = request.query_params.get("selected_key")

    try:
        payload = RiggingDesignReportPreviewService.build_payload(design, request=request, selected_key=selected_key)
        return Response(payload)
    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response(
            {"error": f"Error building design report preview: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def component_options(request):
    """
    GET: Return available component types and their field options
    Returns distinct values for manufacturers, models, capacities, and wire rope specifc options
    """
    from django.db.models import Q
    from apps.main.models import Shackle, Masterlink, MasterlinkAssembly, WireRope, SlingConfiguration

    # Build options with model-manufacturer relationship for frontend dependency logic
    # For non-WireRope components, models include manufacturer metadata to enable:
    # 1. Filtering models by selected manufacturer
    # 2. Auto-filling manufacturer when model is selected
    # 3. Validating manufacturer/model consistency before submission
    options = {
        "Shackle": {
            "manufacturers": list(Shackle.objects.values_list("manufacturer", flat=True).distinct().order_by("manufacturer")),
            "models": [
                {"model": obj["model"], "manufacturer": obj["manufacturer"]}
                for obj in Shackle.objects.values("model", "manufacturer").distinct().order_by("model")
            ],
            "capacities": list(Shackle.objects.values_list("working_load_limit", flat=True).distinct().order_by("working_load_limit")),
        },
        "Masterlink": {
            "manufacturers": list(Masterlink.objects.values_list("manufacturer", flat=True).distinct().order_by("manufacturer")),
            "models": [
                {"model": obj["model"], "manufacturer": obj["manufacturer"]}
                for obj in Masterlink.objects.values("model", "manufacturer").distinct().order_by("model")
            ],
            "capacities": list(Masterlink.objects.values_list("working_load_limit", flat=True).distinct().order_by("working_load_limit")),
        },
        "MasterlinkAssembly": {
            "manufacturers": list(MasterlinkAssembly.objects.values_list("manufacturer", flat=True).distinct().order_by("manufacturer")),
            "models": [
                {"model": obj["model"], "manufacturer": obj["manufacturer"]}
                for obj in MasterlinkAssembly.objects.values("model", "manufacturer").distinct().order_by("model")
            ],
            "capacities": list(MasterlinkAssembly.objects.values_list("working_load_limit", flat=True).distinct().order_by("working_load_limit")),
        },
        "WireRope": {
            "manufacturers": [],
            "models": [],
            "capacities": list(WireRope.objects.values_list("minimum_breaking_load", flat=True).distinct().order_by("minimum_breaking_load")),
            "eye_types": list(SlingConfiguration.objects.values_list("eye_type", flat=True).distinct().order_by("eye_type")),
            "terminations": list(SlingConfiguration.objects.values_list("termination", flat=True).distinct().order_by("termination")),
            "configurations": list(SlingConfiguration.objects.values_list("configuration", flat=True).distinct().order_by("configuration")),
        }
    }

    return Response(options)
