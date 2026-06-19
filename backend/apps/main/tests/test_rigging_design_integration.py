import json
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from apps.main.models import LiftingAnalysis, Masterlink, Project, Shackle, WireRope, RiggingDesign


class TestRiggingDesignIntegration(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="tester", password="pass")
        self.project = Project.objects.create(name="Proj", description="", owner=self.user)
        self.analysis = LiftingAnalysis.objects.create(
            name="Analysis",
            project=self.project,
            maximum_gross_weight=1000.0,
            location="Site",
            configuration={"h_max": 0.0, "L1": 1.0, "L2": 1.0, "h1": 0.0, "h2": 0.0},
            lifting_points_qty=2,
            results={
                "factors": {"dynamic_amplification_factor": 1.0},
                "dynamic_results": {"dynamic_hook_load": 1000.0, "dynamic_sling_loads": {"0": 1000.0}},
                "static_results": {"static_hook_load": 800.0, "static_sling_loads": {"0": 800.0}},
            },
        )
        self.masterlink = Masterlink.objects.create(
            manufacturer="Test",
            model="ML-1",
            working_load_limit=Decimal("50.0"),
            weight=Decimal("1.0"),
            safety_factor=Decimal("5.0"),
            diameter=Decimal("10.0"),
            length_inside=Decimal("20.0"),
            width_inside=Decimal("10.0"),
        )
        self.shackle = Shackle.objects.create(
            manufacturer="Test",
            model="S-1",
            working_load_limit=Decimal("50.0"),
            weight=Decimal("1.0"),
            safety_factor=Decimal("5.0"),
            inside_width=Decimal("10.0"),
            inside_length=Decimal("20.0"),
            bow_width=Decimal("10.0"),
            length=Decimal("20.0"),
            width=Decimal("10.0"),
            bow_diameter=Decimal("10.0"),
            eye_diameter=Decimal("10.0"),
            pin_diameter=Decimal("10.0"),
            bolt_length=Decimal("10.0"),
        )
        self.wire_rope = WireRope.objects.create(
            construction_type="6x36 IWRC",
            material="steel",
            nominal_diameter=Decimal("10.0"),
            tensile_strength=Decimal("1770.0"),
            minimum_breaking_load=Decimal("100.0"),
        )

    def test_create_rigging_design_with_user_preferences_dto(self):
        self.client.force_login(self.user)
        url = reverse("design-design-create", args=[str(self.analysis.id)])
        payload = {
            "name": "Design A",
            "set_active": True,
            "user_preferences": {
                "0": {"component_ref": {"type": "Masterlink", "id": str(self.masterlink.id)}},
                "1": {
                    "component_ref": {"type": "WireRope", "id": str(self.wire_rope.id)},
                    "configuration": "vertical",
                    "termination": "ferrule",
                    "eye_type": "hard",
                },
                "2": {"component_ref": {"type": "Shackle", "id": str(self.shackle.id)}},
            },
        }
        response = self.client.post(
            url,
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get("status"), "success")
        self.assertEqual(RiggingDesign.objects.count(), 1)
