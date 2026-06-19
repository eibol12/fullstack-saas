from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
import uuid



# Common timestamp mixin to avoid repeating timestamp fields
class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True, help_text="Record creation time.")
    updated_at = models.DateTimeField(auto_now=True, help_text="Record last update time.")

    class Meta:
        abstract = True


class Shackle(TimestampedModel):
    """
    Model representing a shackle component.
    """
    # Identification
    manufacturer = models.CharField(max_length=100, help_text="Manufacturer of the shackle.")
    model = models.CharField(max_length=100, help_text="Model of the shackle.")

    # Mechanical Properties
    working_load_limit = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Working Load Limit (WLL) of the shackle in Te."
    )
    weight = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Weight of the shackle in kg."
    )
    safety_factor = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Safety factor of the shackle."
    )

    # Dimensions
    inside_width = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Inside width of the shackle in mm."
    )
    inside_length = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Inside length of the shackle in mm."
    )
    bow_width = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Bow width of the shackle in mm."
    )
    length = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Length of the shackle in mm."
    )
    width = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Width of the shackle in mm."
    )
    bow_diameter = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Bow diameter of the shackle in mm."
    )
    eye_diameter = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Eye diameter of the shackle in mm."
    )
    pin_diameter = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Pin diameter of the shackle in mm."
    )
    bolt_length = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Bolt length of the shackle in mm."
    )

    # Optional tolerances
    tolerance_inside_width = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Tolerance inside width of the shackle in mm."
    )
    tolerance_inside_length = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Tolerance inside length of the shackle in mm."
    )

    def __str__(self):
        return f"Shackle {self.manufacturer} {self.model} - WLL: {self.working_load_limit} Te"

    class Meta:
        verbose_name = "Shackle"
        verbose_name_plural = "Shackles"
        ordering = ["working_load_limit"]


# Improved Masterlink models to avoid null fields
class BaseMasterlink(TimestampedModel):
    """
    Base abstract model for all masterlink types.
    """
    # Common identification fields
    manufacturer = models.CharField(max_length=100, help_text="Manufacturer of the masterlink.")
    model = models.CharField(max_length=100, help_text="Model of the masterlink.")

    # Common mechanical properties
    working_load_limit = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Working Load Limit (WLL) of the masterlink in Te."
    )
    weight = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Weight of the masterlink in kg."
    )
    safety_factor = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Safety factor of the masterlink."
    )

    # Dimensions specific to single masterlinks
    diameter = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Diameter of the masterlink in mm."
    )
    length_inside = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Length inside the masterlink in mm."
    )
    width_inside = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Width inside the masterlink in mm."
    )

    class Meta:
        abstract = True


class Masterlink(BaseMasterlink):
    """
    Model representing a single forged masterlink.
    """
    def __str__(self):
        return f"Masterlink {self.manufacturer} {self.model} - WLL: {self.working_load_limit} Te"

    class Meta:
        verbose_name = "Masterlink"
        verbose_name_plural = "Masterlinks"
        ordering = ["working_load_limit"]


class MasterlinkAssembly(BaseMasterlink):
    """
    Model representing an assembly masterlink.
    """
    # Dimensions specific to assembly masterlinks
    diameter = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Diameter of the masterlink components in mm."
    )
    length_inside = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Length inside the masterlink in mm."
    )
    width_inside = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Width inside the masterlink in mm."
    )
    assembly_diameter = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Diameter of the assembly in mm."
    )
    assembly_length_inside = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Length inside the assembly in mm."
    )
    assembly_width_inside = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Width inside the assembly in mm."
    )

    def __str__(self):
        return f"Masterlink Assembly {self.manufacturer} {self.model} - WLL: {self.working_load_limit} Te"

    class Meta:
        verbose_name = "Masterlink Assemblies"
        verbose_name_plural = "Masterlinks Assemblies"
        ordering = ["working_load_limit"]

class BaseSling(TimestampedModel):
    """Abstract base class for all sling types"""
    MATERIALS = (
        ("steel", "Steel"),
        ("HMPE", "HMPE"),
        ("aramid", "Aramid"),
        ("other", "Other"),
    )

    # Common fields for all sling types
    construction_type = models.CharField(max_length=100, help_text="Construction type of the sling.")
    material = models.CharField(max_length=100, choices=MATERIALS, help_text="Material of the sling.")
    nominal_diameter = models.DecimalField(max_digits=10, decimal_places=2, help_text="Nominal diameter in mm.")

    class Meta:
        abstract = True

class WireRope(BaseSling):
    """Wire rope specific implementation"""
    tensile_strength = models.DecimalField(max_digits=10, decimal_places=3, help_text="Tensile strength in MPa.")
    minimum_breaking_load = models.DecimalField(max_digits=10, decimal_places=3, help_text="Minimum breaking load in Te.")

    def __str__(self):
        return f"Wire Rope MBL: {self.minimum_breaking_load} Te Dia: {self.nominal_diameter:.1f} mm"

    class Meta:
        verbose_name = "Wire Rope"
        verbose_name_plural = "Wire Ropes"
        ordering = ["minimum_breaking_load"]

class ThimbleManager(models.Manager):
    def for_diameter(self, diameter):
        """Return the thimble compatible with the specified wire rope diameter"""
        return self.filter(
            min_wire_rope_diameter__lte=diameter,
            max_wire_rope_diameter__gte=diameter,
        )

class Thimble(models.Model):
    weight = models.DecimalField(max_digits=10, decimal_places=2, help_text="Weight of the thimble in kg.")
    min_wire_rope_diameter = models.DecimalField(max_digits=10, decimal_places=2, help_text="Minimum diameter of the wire rope in mm.")
    max_wire_rope_diameter = models.DecimalField(max_digits=10, decimal_places=2, help_text="Maximum diameter of the wire rope in mm.")
    width_groove = models.DecimalField(max_digits=10, decimal_places=2, help_text="Width of the groove in mm.")
    width_overall = models.DecimalField(max_digits=10, decimal_places=2, help_text="Width of the overall sling in mm.")
    length = models.DecimalField(max_digits=10, decimal_places=2, help_text="Length of the thimble in mm.")
    length_inside = models.DecimalField(max_digits=10, decimal_places=2, help_text="Length inside the thimble in mm.")
    width_inside = models.DecimalField(max_digits=10, decimal_places=2, help_text="Width inside the thimble in mm.")
    thickness_back = models.DecimalField(max_digits=10, decimal_places=2, help_text="Thickness of the back in mm.")
    width = models.DecimalField(max_digits=10, decimal_places=2, help_text="Width of the thimble in mm.")

    objects = ThimbleManager()

    def __str__(self):
        if self.min_wire_rope_diameter == self.max_wire_rope_diameter:
            return f"Wire Rope Thimble Dia: {self.min_wire_rope_diameter:.1f} mm"
        else:
            return f"Wire Rope Thimble Dia: {self.min_wire_rope_diameter:.1f} - {self.max_wire_rope_diameter:.1f} mm"

    class Meta:
        verbose_name = "Thimble"
        verbose_name_plural = "Thimbles"
        ordering = ["min_wire_rope_diameter"]


class FibreSling(BaseSling):
    """Fibre sling specific implementation"""
    safety_factor = models.DecimalField(max_digits=10, decimal_places=2, help_text="Safety factor.")
    working_load_limit = models.DecimalField(max_digits=10, decimal_places=2, help_text="Working Load Limit in Te.")
    elongation = models.DecimalField(max_digits=10, decimal_places=2, help_text="Elongation percentage.", null=True)

    def __str__(self):
        return f"Fibre Sling WLL: {self.working_load_limit} Te Dia: {self.nominal_diameter:.1f} mm"

class Grommet(BaseSling):
    """Grommet specific implementation"""
    safety_factor = models.DecimalField(max_digits=10, decimal_places=2, help_text="Safety factor.")
    working_load_limit = models.DecimalField(max_digits=10, decimal_places=2, help_text="Working Load Limit in Te.")

    def __str__(self):
        return f"Grommet WLL: {self.working_load_limit} Te Dia: {self.nominal_diameter:.1f} mm"


class SlingConfiguration(models.Model):
    """
    Model representing configurations of slings with polymorphic relationship.
    """
    CONFIGURATIONS = (
        ("vertical", "Vertical"),
        ("basket", "Basket"),
        ("choke", "Choke"),
    )

    TERMINATIONS = (
        ("hand splice", "Hand Splice"),
        ("ferrule", "Ferrule"),
        ("molten metal", "Molten Metal"),
        ("resin poured sockets", "Resin Poured Sockets"),
    )

    EYE_TYPES = (
        ("hard", "Hard"),
        ("soft", "Soft"),
    )

    # Generic foreign key to handle different sling types
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        verbose_name="Sling type",
        help_text="Type of sling (WireRope, Grommet, FibreSling)",
    )
    object_id = models.PositiveIntegerField(
        verbose_name="Sling ID",
        help_text="ID of the referenced sling"
    )
    sling_object = GenericForeignKey("content_type", "object_id")

    # Configuration details
    configuration = models.CharField(
        max_length=100,
        choices=CONFIGURATIONS,
        help_text="Configuration of the sling."
    )
    termination = models.CharField(
        max_length=100,
        choices=TERMINATIONS,
        help_text="Termination of the sling design_data."
    )
    eye_type = models.CharField(
        max_length=100,
        choices=EYE_TYPES,
        help_text="Type of eye."
    )

    def __str__(self):
        return f"{self.sling_object} - {self.configuration}, {self.termination}, {self.eye_type} eye - {self.eye_type} eye."

    class Meta:
        verbose_name = "Sling Configuration"
        verbose_name_plural = "Sling Configurations"
        # Ensure no duplicate configurations for the same sling
        unique_together = ['content_type', 'object_id', 'configuration', 'termination', 'eye_type']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
        ]


@receiver(pre_delete, sender=WireRope)
def delete_wire_rope_configurations(sender, instance, **kwargs):
    """Delete configurations when a WireRope is deleted"""
    content_type = ContentType.objects.get_for_model(WireRope)
    SlingConfiguration.objects.filter(
        content_type=content_type,
        object_id=instance.id
    ).delete()

@receiver(pre_delete, sender=FibreSling)
def delete_fibre_sling_configurations(sender, instance, **kwargs):
    """Delete configurations when a FibreSling is deleted"""
    content_type = ContentType.objects.get_for_model(FibreSling)
    SlingConfiguration.objects.filter(
        content_type=content_type,
        object_id=instance.id
    ).delete()

@receiver(pre_delete, sender=Grommet)
def delete_grommet_configurations(sender, instance, **kwargs):
    """Delete configurations when a Grommet is deleted"""
    content_type = ContentType.objects.get_for_model(Grommet)
    SlingConfiguration.objects.filter(
        content_type=content_type,
        object_id=instance.id
    ).delete()

class UserProfile(TimestampedModel):
    """Lightweight profile storing additional user info."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    company = models.CharField(max_length=150, blank=True, help_text="Company of the user.")
    company_logo = models.FileField(
        upload_to="company_logos/",
        blank=True,
        null=True,
        help_text="Optional company logo used on branded engineering reports."
    )
    report_prepared_by = models.CharField(
        max_length=150,
        blank=True,
        help_text="Optional default prepared-by name used on engineering reports."
    )

    def __str__(self):
        return f"Profile for {self.user.username}"


class Project(TimestampedModel):
    """Model for storing project information"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, help_text="Name of the project.")
    description = models.TextField(help_text="Description of the project.", blank=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="projects", help_text="User who created the project.", null=True)

    def __str__(self):
        return self.name

class LiftingAnalysis(TimestampedModel):
    class LocationChoices(models.TextChoices):
        OFFSHORE = "offshore", "Offshore"
        ONSHORE = "onshore", "Onshore"
        INSHORE = "inshore", "Inshore"
        SUBSEA = "subsea", "Subsea"

    class LiftingPointsChoices(models.IntegerChoices):
        ONE = 1, "1 point"
        TWO = 2, "2 points"
        THREE = 3, "3 points"
        FOUR = 4, "4 points"

    """Model for storing lift analysis results"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, help_text="Name of the analysis.")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name= "analyses")
    maximum_gross_weight = models.FloatField()
    location = models.CharField(max_length=100,choices= LocationChoices.choices, help_text="Location of the lift analysis.")
    configuration = models.JSONField()
    lifting_points_qty = models.IntegerField(choices=LiftingPointsChoices.choices)
    results = models.JSONField()

    def __str__(self):
        return f"Project: {self.project.name} - Location: {self.location} - MGW: {self.maximum_gross_weight:.2f} kg - Lifting Points: {self.lifting_points_qty}"


class RiggingDesign(TimestampedModel):
    """Model for storing design design results.

    Requirements:
    - Has id, arrangement, results.
    - Many RiggingDesign rows can be linked to a single LiftingAnalysis, but only one analysis per design.
    - If linked to an analysis, it must also be linked to the pertaining Project of that LiftingAnalysis.
    - Includes a few typical fields helpful for versioning and organization.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Main relationships
    analysis = models.ForeignKey(
        LiftingAnalysis,
        on_delete=models.CASCADE,
        related_name='designs',
        null=True,
        help_text="Lifting analysis this design design is based on."
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='rigging_designs',
        null=True,
        help_text="Project inherited from the linked analysis.")

    # Descriptive/organizational fields
    name = models.CharField(max_length=150, default="", blank=True, help_text="Human-readable title for the design.")
    status = models.CharField(
        max_length=20,
        choices=(
            ("draft", "Draft"),
            ("final", "Final"),
        ),
        default="draft",
        help_text="Lifecycle status of the design.")
    version = models.PositiveIntegerField(default=1, help_text="Version number of this design for the given analysis.")
    notes = models.TextField(blank=True, help_text="Optional notes or rationale.")
    is_active = models.BooleanField(default=True, help_text="Convenience flag to mark the active/preferred design.")

    # Core payloads
    arrangement = models.JSONField(help_text="Arrangement of selected components.")
    results = models.JSONField(help_text="Full design results, including utilizations and factors.")

    def clean(self):
        # Ensure project matches analysis.project when both are set
        if self.analysis_id and self.project_id:
            if self.analysis.project_id != self.project_id:
                raise ValidationError({
                    'project': "Project must match the project of the linked analysis.",
                })

    def save(self, *args, **kwargs):
        # Auto-assign project from analysis if not provided or mismatched
        if self.analysis_id:
            analysis_project_id = self.analysis.project_id
            if not self.project_id or self.project_id != analysis_project_id:
                self.project_id = analysis_project_id
        super().save(*args, **kwargs)

    def __str__(self):
        display = self.name if self.name else str(self.id)
        if self.analysis:
            return f"Rigging Design {display} | Analysis: {self.analysis.name}"
        return f"Rigging Design {display} | Analysis: Manual"

    class Meta:
        indexes = [
            models.Index(fields=["analysis", "project"]),
        ]
        unique_together = (
            ("analysis", "name", "version"),
        )
