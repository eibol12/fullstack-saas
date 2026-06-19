from rest_framework import serializers
from apps.main.models import LiftingAnalysis , Project
from domain.geometry.corner_to_cog import convert_corner_coords_to_cog_config
from domain.utils.exceptions import DomainValidationError

class LiftingAnalysisSummarySerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model = LiftingAnalysis
        fields = ("id", "name", "project_name", "maximum_gross_weight", "location", "lifting_points_qty", "created_at", "updated_at")
        read_only_fields = fields

class LiftingAnalysisSerializer(serializers.ModelSerializer):
    project_id = serializers.PrimaryKeyRelatedField(queryset = Project.objects.all(), source="project", write_only=True)
    # Optional corner-reference geometry payload. When provided, the serializer
    # converts it into the legacy `configuration` shape consumed by the DNV
    # engine. Legacy `configuration` payloads remain accepted for backwards
    # compatibility during the rollout (see Step 2 of the UX refactor plan).
    geometry_input = serializers.JSONField(required=False, write_only=True)

    class Meta:
        model = LiftingAnalysis
        fields = ("id", "name", "project", "project_id", "maximum_gross_weight", "location", "lifting_points_qty", "configuration", "geometry_input", "results", "created_at", "updated_at")
        read_only_fields = ("id", "results", "created_at", "updated_at", "project")
        extra_kwargs = {
            # When `geometry_input` is supplied we derive `configuration` from
            # it, so the legacy field is optional on create/update.
            "configuration": {"required": False},
            "lifting_points_qty": {"required": False},
        }

    def validate_lifting_points_qty(self, value):
        if value not in [1,2,3,4]:
            raise serializers.ValidationError("Lifting points quantity must be 1, 2, 3 or 4.")
        return value

    def validate(self, attrs):
        """Convert `geometry_input` (if present) into the engine's `configuration` shape."""
        geometry_input = attrs.pop("geometry_input", None)
        if geometry_input is not None:
            try:
                derived_config = convert_corner_coords_to_cog_config(geometry_input)
            except DomainValidationError as exc:
                raise serializers.ValidationError({"geometry_input": str(exc)})

            # Preserve engineering knobs the corner payload doesn't carry
            # (e.g. `h_max`, `quadrant`) from any legacy configuration the
            # client also sent or from the existing instance on PATCH.
            base_config = dict(attrs.get("configuration") or {})
            if self.instance is not None and not base_config:
                base_config = dict(getattr(self.instance, "configuration", {}) or {})
            for preserved_key in ("h_max", "quadrant"):
                if preserved_key in base_config and preserved_key not in derived_config:
                    derived_config[preserved_key] = base_config[preserved_key]

            attrs["configuration"] = derived_config
            attrs["lifting_points_qty"] = int(derived_config["lifting_points_qty"])
        return attrs
