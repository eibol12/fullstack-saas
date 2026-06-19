from rest_framework import serializers
from apps.main.models import RiggingDesign, Project, LiftingAnalysis


class ComponentRefSerializer(serializers.Serializer):
    """Serializer for component references in user preferences."""
    type = serializers.ChoiceField(
        choices=["Shackle", "Masterlink", "MasterlinkAssembly", "WireRope"],
        help_text="Component type"
    )
    id = serializers.UUIDField(help_text="Component UUID")


class UserPreferenceSerializer(serializers.Serializer):
    """
    Serializer for a single position user preference.

    Handles optional component filters sent from frontend.
    Provides defensive normalization to convert empty strings to None.

    Why normalization is needed:
    - required=False only means the key can be MISSING
    - It does NOT mean empty string ("") is valid for FloatField
    - Frontend may send "" for unselected <select> options
    - to_internal_value() normalizes "" → None before validation
    """
    component_ref = ComponentRefSerializer(required=False, allow_null=True)
    component_type = serializers.ChoiceField(
        choices=["Shackle", "Masterlink", "MasterlinkAssembly", "WireRope"],
        required=False,
        allow_null=True,
        help_text="Component type filter (alternative to component_ref)"
    )
    capacity = serializers.FloatField(required=False, allow_null=True, help_text="Desired capacity")
    manufacturer = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    model = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    configuration = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    termination = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    eye_type = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def to_internal_value(self, data):
        """
        Normalize empty strings before validation.

        Converts:
        - "" → None for nullable fields (capacity, component_type)
        - "" → None for optional filter fields (manufacturer, model, etc.)

        This provides defensive handling if frontend still sends empty strings.
        Prevents validation errors like: "A valid number is required" for capacity="".

        Example:
        Input:  {"component_type": "WireRope", "capacity": "", "eye_type": ""}
        Normalized: {"component_type": "WireRope", "capacity": None, "eye_type": None}
        """
        if not isinstance(data, dict):
            return super().to_internal_value(data)

        # Create a copy to avoid mutating input
        normalized = data.copy()

        # Fields that should be None instead of empty string
        nullable_fields = [
            'capacity',
            'component_type',
            'component_ref',
            'manufacturer',
            'model',
            'configuration',
            'termination',
            'eye_type'
        ]

        for field in nullable_fields:
            if field in normalized and normalized[field] == "":
                normalized[field] = None

        return super().to_internal_value(normalized)


class RiggingDesignSummarySerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing designs."""
    analysis_id = serializers.UUIDField(source='analysis.id', read_only=True, allow_null=True)
    analysis_name = serializers.SerializerMethodField()
    project_id = serializers.UUIDField(source='project.id', read_only=True)

    def get_analysis_name(self, obj):
        return obj.analysis.name if obj.analysis else None

    class Meta:
        model = RiggingDesign
        fields = (
            "id",
            "analysis_id",
            "analysis_name",
            "project_id",
            "name",
            "version",
            "status",
            "is_active",
            "created_at",
            "updated_at"
        )
        read_only_fields = fields


class RiggingDesignSerializer(serializers.ModelSerializer):
    """Full serializer for rigging design details."""
    analysis = serializers.SerializerMethodField()
    project = serializers.SerializerMethodField()

    class Meta:
        model = RiggingDesign
        fields = (
            "id",
            "analysis",
            "project",
            "name",
            "version",
            "status",
            "is_active",
            "arrangement",
            "results",
            "created_at",
            "updated_at"
        )
        read_only_fields = (
            "id",
            "analysis",
            "project",
            "version",
            "arrangement",
            "results",
            "created_at",
            "updated_at"
        )

    def get_analysis(self, obj):
        """Return minimal analysis info."""
        if obj.analysis:
            return {
                "id": str(obj.analysis.id),
                "name": obj.analysis.name,
            }
        return None

    def get_project(self, obj):
        """Return minimal project info."""
        if obj.project:
            return {
                "id": str(obj.project.id),
                "name": obj.project.name,
            }
        return None


class CreateRiggingDesignSerializer(serializers.Serializer):
    """Serializer for creating a rigging design from an analysis."""
    analysis_id = serializers.UUIDField(
        required=True,
        help_text="UUID of the LiftingAnalysis to base the design on"
    )
    name = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=150,
        help_text="Optional name for the design"
    )
    set_active = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Whether to set this design as active"
    )
    user_preferences = UserPreferenceSerializer(many=True, required=False)
    # user_preferences = serializers.DictField(
    #     child=UserPreferenceSerializer(),
    #     required=False,
    #     allow_null=True,
    #     help_text="User preferences keyed by position index (0, 1, 2, ...)"
    # )

    def validate_analysis_id(self, value):
        """Verify analysis exists and user has access."""
        user = self.context.get('request').user if self.context.get('request') else None
        try:
            analysis = LiftingAnalysis.objects.select_related('project').get(id=value)
            if user and analysis.project.owner != user:
                raise serializers.ValidationError("You don't have permission to access this analysis.")
            return value
        except LiftingAnalysis.DoesNotExist:
            raise serializers.ValidationError("Analysis not found.")


class UpdateRiggingDesignSerializer(serializers.Serializer):
    """Serializer for updating a rigging design.

    Supports both metadata-only updates (``name``, ``status``, ``is_active``)
    and engineering updates (``user_preferences``) which trigger an in-place
    recompute on the same row (see ``RiggingDesignService.recompute_design``).
    """
    name = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=150
    )
    status = serializers.ChoiceField(
        choices=["draft", "final"],
        required=False
    )
    is_active = serializers.BooleanField(required=False)
    user_preferences = UserPreferenceSerializer(many=True, required=False)