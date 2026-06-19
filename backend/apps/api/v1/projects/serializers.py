from rest_framework import serializers
from apps.main.models import Project, LiftingAnalysis, RiggingDesign
from ..analysis.serializers import LiftingAnalysisSummarySerializer


class _OverviewDesignSerializer(serializers.ModelSerializer):
    """Compact design row for the dashboard overview table."""
    has_report = serializers.SerializerMethodField()

    class Meta:
        model = RiggingDesign
        fields = (
            "id",
            "name",
            "version",
            "status",
            "is_active",
            "has_report",
            "updated_at",
        )
        read_only_fields = fields

    def get_has_report(self, obj: RiggingDesign) -> bool:
        # A design is "report-ready" once the engine has populated `results`.
        # The report endpoint (`/api/v1/design/<id>/report/`) depends on it.
        return bool(obj.results)


class _OverviewAnalysisSerializer(serializers.ModelSerializer):
    """Compact analysis row + nested designs for the dashboard overview."""
    designs = _OverviewDesignSerializer(many=True, read_only=True)

    class Meta:
        model = LiftingAnalysis
        fields = (
            "id",
            "name",
            "location",
            "maximum_gross_weight",
            "lifting_points_qty",
            "updated_at",
            "designs",
        )
        read_only_fields = fields


class ProjectOverviewSerializer(serializers.ModelSerializer):
    """
    Flattened payload for the centralized dashboard table.

    Mirrors the `GET /api/v1/projects/overview/` contract described in the
    engineer-UX refactor plan: every project carries its analyses and, per
    analysis, its rigging designs, so the FE can render the whole
    hierarchical table from a single request.
    """
    analyses = _OverviewAnalysisSerializer(many=True, read_only=True)
    analyses_count = serializers.SerializerMethodField()
    designs_count = serializers.SerializerMethodField()
    maximum_gross_weight = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "id",
            "name",
            "description",
            "maximum_gross_weight",
            "analyses_count",
            "designs_count",
            "created_at",
            "updated_at",
            "analyses",
        )
        read_only_fields = fields

    def get_analyses_count(self, obj: Project) -> int:
        # `.analyses.all()` uses the prefetched cache populated by
        # `ProjectSelector.get_dashboard_rows`.
        return len(obj.analyses.all())

    def get_designs_count(self, obj: Project) -> int:
        return sum(len(a.designs.all()) for a in obj.analyses.all())

    def get_maximum_gross_weight(self, obj: Project) -> float | None:
        """
        Project-level "dry weight" surrogate.

        The product team decided to reuse `LiftingAnalysis.maximum_gross_weight`
        as the project dry weight (no schema change). When multiple analyses
        exist we return the largest MGW so the table reflects the worst-case
        load the project has been evaluated against.
        """
        weights = [
            a.maximum_gross_weight
            for a in obj.analyses.all()
            if a.maximum_gross_weight is not None
        ]
        return max(weights) if weights else None


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ("id", "name", "description", "created_at", "updated_at")
        extra_kwargs = {
            "name": {"required": True},
            "description": {"required": False, "allow_blank": True},
        }
        read_only_fields = ("id","created_at", "updated_at")



class ProjectDetailSerializer(serializers.ModelSerializer):
    analyses_count = serializers.IntegerField()
    analyses = LiftingAnalysisSummarySerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = ("id", "name", "description", "created_at", "updated_at", "analyses_count", "analyses")
        read_only_fields = fields
