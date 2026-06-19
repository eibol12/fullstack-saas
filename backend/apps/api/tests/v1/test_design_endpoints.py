import pytest
from django.urls import reverse
from rest_framework import status
from unittest.mock import patch

from apps.main.models import Project, LiftingAnalysis, RiggingDesign, UserProfile
from domain.utils.exceptions import (
    InvalidArrangementLengthError,
    InvalidFirstComponentError,
    MissingRequiredComponentError,
    WireRopeLastComponentError,
)


pytestmark = pytest.mark.django_db


# Helper to create valid design payload
def make_design_payload(analysis_id, name="Test Design"):
    """Create a valid design request payload."""
    return {
        "analysis_id": str(analysis_id),
        "name": name,
        "set_active": False,
        "user_preferences": []  # Empty preferences for simple tests
    }


def make_report_ready_results():
    return {
        "sling_lengths": [12.5],
        "summary": {
            "lifting_points_qty": 1,
        },
        "calculation_context": {
            "static": {
                "hook_load": 980.0,
                "controlling_sling_load": 980.0,
            },
            "dynamic": {
                "hook_load": 1127.0,
                "controlling_sling_load": 1127.0,
            },
            "dnv_factors": {
                "dynamic_amplification_factor": 1.15,
            },
        },
        "optimal_combinations": {
            "conservative": {
                "overall_compatible": True,
                "warning_message": None,
                "geometric_warning": None,
                "items": [
                    {
                        "position": 0,
                        "component_type": "WireRope",
                        "component_id": "wire-rope-1",
                        "utilization": 0.82,
                        "configuration": "vertical",
                        "termination": "ferrule",
                        "eye_type": "hard",
                    }
                ],
                "component_factors": {
                    "0": {
                        "minimum_breaking_load": 100.0,
                        "nominal_safety_factor": 5.0,
                    }
                },
                "component_traces": {
                    "0": {
                        "meta": {
                            "position": 0,
                        },
                        "inputs": {},
                        "factors": {},
                        "intermediates": {},
                        "checks": {
                            "UR1": {
                                "value": 0.82,
                            }
                        },
                        "results": {
                            "utilization": {
                                "value": 0.82,
                            },
                            "controlling_check": "UR1",
                        },
                    }
                },
                "compatibility_details": [
                    {
                        "compatible": True,
                        "reason": "Compatible for the selected arrangement.",
                    }
                ],
            }
        },
    }


def make_two_point_report_ready_results():
    return {
        "sling_lengths": [3.605551275463989, 3.605551275463989],
        "summary": {
            "lifting_points_qty": 2,
        },
        "calculation_context": {
            "units": {
                "load": "Te",
                "diameter": "mm",
                "ratio": "-",
                "utilization": "-",
                "factor": "-",
            },
            "static": {
                "hook_load": 9.79902,
                "controlling_sling_load": 5.8884781765495235,
            },
            "dynamic": {
                "hook_load": 17.624866599569916,
                "controlling_sling_load": 11.120788043393345,
            },
            "dnv_factors": {
                "dynamic_amplification_factor": 1.7986356390302207,
            },
        },
        "optimal_combinations": {
            "conservative": {
                "overall_compatible": True,
                "warning_message": None,
                "geometric_warning": None,
                "items": [
                    {
                        "position": 0,
                        "component_type": "Masterlink",
                        "component_id": "6",
                        "utilization": 0.5974531050701667,
                        "manufacturer": "Crosby",
                        "model": "A-345",
                        "wll_or_mbl": 17.7,
                    },
                    {
                        "position": 1,
                        "component_type": "WireRope",
                        "component_id": "14",
                        "utilization": 0.6562906134442401,
                        "configuration": "vertical",
                        "termination": "ferrule",
                        "eye_type": "hard",
                        "manufacturer": "Bridon",
                        "model": "26 mm IWRC",
                        "wll_or_mbl": 48.11,
                    },
                    {
                        "position": 2,
                        "component_type": "Shackle",
                        "component_id": "11",
                        "utilization": 0.6508317984607368,
                        "manufacturer": "Crosby",
                        "model": "G-2130",
                        "wll_or_mbl": 9.5,
                    },
                ],
                "component_factors": [
                    {
                        "component_type": "Masterlink",
                        "minimum_breaking_load": 88.5,
                        "proof_load": 35.4,
                        "minimum_safety_factor": 3,
                    },
                    {
                        "component_type": "WireRope",
                        "minimum_breaking_load": 48.11,
                        "effective_mbl": 48.11,
                        "nominal_safety_factor": 2.8392,
                        "termination": "ferrule",
                        "eye_type": "hard",
                        "before_component_id": 6,
                        "after_component_id": 11,
                    },
                    {
                        "component_type": "Shackle",
                        "minimum_breaking_load": 57.0,
                        "proof_load": 19.0,
                        "minimum_safety_factor": 3,
                    },
                ],
                "component_traces": [
                    {
                        "meta": {
                            "position": 0,
                            "component_type": "Masterlink",
                            "component_id": "6",
                        },
                        "inputs": {
                            "WLL": {"value": 17.7, "unit": "Te", "source": None, "eqn": None, "note": None},
                            "manufacturer_safety_factor": {"value": 5.0, "unit": None, "source": None, "eqn": None, "note": None},
                            "minimum_safety_factor": {"value": 3, "unit": None, "source": None, "eqn": None, "note": None},
                            "DAF": {"value": 1.7986356390302207, "unit": None, "source": None, "eqn": None, "note": None},
                            "acting_load": {"value": 17.624866599569916, "unit": "Te", "source": None, "eqn": None, "note": None},
                            "SWL": {"value": 17.7, "unit": "Te", "source": None, "eqn": None, "note": None},
                        },
                        "intermediates": {
                            "proof_load": {"value": 35.4, "unit": "Te", "source": None, "eqn": "PL = 2*SWL if SWL<=25 else 1.22*SWL+20", "note": None},
                            "minimum_breaking_load": {"value": 88.5, "unit": "Te", "source": None, "eqn": "MBL = SWL * SF_mfg", "note": None},
                        },
                        "checks": {
                            "UR1": {"value": 0.5974531050701667, "unit": None, "source": None, "eqn": "UR1 = Load * SF_min / MBL", "note": None},
                            "UR2": {"value": 0.5536169491525424, "unit": None, "source": None, "eqn": "UR2 = Load / (SWL * DAF)", "note": None},
                            "UR3": {"value": 0.4978775875584722, "unit": None, "source": None, "eqn": "UR3 = Load / ProofLoad", "note": None},
                        },
                        "results": {
                            "utilization": {
                                "value": 0.5974531050701667,
                            },
                            "controlling_check": "UR1",
                        },
                    },
                    {
                        "meta": {
                            "position": 1,
                            "component_type": "WireRope",
                            "component_id": "14",
                        },
                        "inputs": {
                            "acting_load": {"value": 11.120788043393345, "unit": "Te", "source": None, "eqn": None, "note": None},
                            "MBL": {"value": 48.11, "unit": "Te", "source": None, "eqn": None, "note": None},
                            "wire_diameter": {"value": 26.0, "unit": "mm", "source": None, "eqn": None, "note": None},
                            "min_bending_diameter": {"value": 28.7, "unit": "mm", "source": None, "eqn": None, "note": None},
                            "configuration": {"value": "vertical", "unit": None, "source": None, "eqn": None, "note": None},
                            "eye_type": {"value": "hard", "unit": None, "source": None, "eqn": None, "note": None},
                            "termination": {"value": "ferrule", "unit": None, "source": None, "eqn": None, "note": None},
                            "material": {"value": "Steel", "unit": None, "source": None, "eqn": None, "note": None},
                        },
                        "factors": {
                            "config_factor": {"value": 1.0, "unit": None, "source": None, "eqn": None, "note": None},
                            "lifting_factor": {"value": 1.3, "unit": None, "source": None, "eqn": None, "note": None},
                            "consequence_factor": {"value": 1.3, "unit": None, "source": None, "eqn": None, "note": None},
                            "wear_factor": {"value": 1.0, "unit": None, "source": None, "eqn": None, "note": None},
                            "material_factor": {"value": 1.5, "unit": None, "source": None, "eqn": None, "note": None},
                            "termination_factor": {"value": 1.12, "unit": None, "source": None, "eqn": None, "note": None},
                            "eye_bending_factor": {"value": 1.0, "unit": None, "source": None, "eqn": "per _calculate_eye_bending_factor", "note": None},
                            "config_bending_factor": {"value": 1, "unit": None, "source": None, "eqn": None, "note": None},
                            "governing_bending_factor": {"value": 1.0, "unit": None, "source": None, "eqn": None, "note": None},
                        },
                        "intermediates": {
                            "D_over_d": {"value": 1.103846153846154, "unit": "-", "source": None, "eqn": None, "note": None},
                            "nominal_safety_factor": {"value": 2.8392000000000004, "unit": None, "source": None, "eqn": None, "note": None},
                            "effective_MBL": {"value": 48.11, "unit": "Te", "source": None, "eqn": None, "note": None},
                        },
                        "results": {
                            "utilization": {
                                "value": 0.6562906134442401,
                            }
                        },
                    },
                    {
                        "meta": {
                            "position": 2,
                            "component_type": "Shackle",
                            "component_id": "11",
                        },
                        "inputs": {
                            "WLL": {"value": 9.5, "unit": "Te", "source": None, "eqn": None, "note": None},
                            "manufacturer_safety_factor": {"value": 6.0, "unit": None, "source": None, "eqn": None, "note": None},
                            "minimum_safety_factor": {"value": 3, "unit": None, "source": None, "eqn": None, "note": None},
                            "DAF": {"value": 1.7986356390302207, "unit": None, "source": None, "eqn": None, "note": None},
                            "acting_load": {"value": 11.120788043393345, "unit": "Te", "source": None, "eqn": None, "note": None},
                            "SWL": {"value": 9.5, "unit": "Te", "source": None, "eqn": None, "note": None},
                        },
                        "intermediates": {
                            "proof_load": {"value": 19.0, "unit": "Te", "source": None, "eqn": "PL = 2*SWL if SWL<=25 else 1.22*SWL+20", "note": None},
                            "minimum_breaking_load": {"value": 57.0, "unit": "Te", "source": None, "eqn": "MBL = SWL * SF_mfg", "note": None},
                        },
                        "checks": {
                            "UR1": {"value": 0.5853046338628076, "unit": None, "source": None, "eqn": "UR1 = Load * SF_min / MBL", "note": None},
                            "UR2": {"value": 0.6508317984607368, "unit": None, "source": None, "eqn": "UR2 = Load / (SWL * DAF)", "note": None},
                            "UR3": {"value": 0.5853046338628076, "unit": None, "source": None, "eqn": "UR3 = Load / ProofLoad", "note": None},
                        },
                        "results": {
                            "utilization": {
                                "value": 0.6508317984607368,
                            },
                            "controlling_check": "UR2",
                        },
                    },
                ],
                "compatibility_details": [
                    {
                        "first_component_dict": {
                            "component_id": "6",
                            "component_type": "Masterlink",
                        },
                        "second_component_dict": {
                            "component_id": "14",
                            "component_type": "WireRope",
                        },
                        "compatible": True,
                        "reason": None,
                    },
                    {
                        "first_component_dict": {
                            "component_id": "14",
                            "component_type": "WireRope",
                        },
                        "second_component_dict": {
                            "component_id": "11",
                            "component_type": "Shackle",
                        },
                        "compatible": True,
                        "reason": None,
                    },
                ],
            }
        },
    }


def make_multi_combination_report_ready_results():
    return {
        "sling_lengths": [8.2],
        "summary": {
            "lifting_points_qty": 1,
        },
        "calculation_context": {
            "units": {
                "load": "Te",
                "diameter": "mm",
                "ratio": "-",
                "utilization": "-",
                "factor": "-",
            },
            "static": {
                "hook_load": 8.5,
                "controlling_sling_load": 8.5,
            },
            "dynamic": {
                "hook_load": 10.2,
                "controlling_sling_load": 10.2,
            },
            "dnv_factors": {
                "dynamic_amplification_factor": 1.2,
            },
        },
        "optimal_combinations": {
            "minimum": {
                "overall_compatible": True,
                "warning_message": None,
                "geometric_warning": None,
                "items": [
                    {
                        "position": 0,
                        "component_type": "Shackle",
                        "component_id": "shackle-min",
                        "utilization": 0.94,
                    }
                ],
                "component_factors": {
                    "0": {
                        "component_type": "Shackle",
                        "minimum_breaking_load": 42.0,
                        "proof_load": 14.0,
                    }
                },
                "component_traces": {
                    "0": {
                        "meta": {
                            "position": 0,
                            "component_type": "Shackle",
                            "component_id": "shackle-min",
                        },
                        "results": {
                            "utilization": {
                                "value": 0.94,
                            },
                            "controlling_check": "UR2",
                        },
                    }
                },
                "compatibility_details": [],
            },
            "conservative": {
                "overall_compatible": True,
                "warning_message": None,
                "geometric_warning": None,
                "items": [
                    {
                        "position": 0,
                        "component_type": "WireRope",
                        "component_id": "wire-rope-cons",
                        "utilization": 0.76,
                        "configuration": "vertical",
                        "termination": "ferrule",
                        "eye_type": "hard",
                    }
                ],
                "component_factors": {
                    "0": {
                        "component_type": "WireRope",
                        "minimum_breaking_load": 60.0,
                        "nominal_safety_factor": 3.5,
                    }
                },
                "component_traces": {
                    "0": {
                        "meta": {
                            "position": 0,
                            "component_type": "WireRope",
                            "component_id": "wire-rope-cons",
                        },
                        "results": {
                            "utilization": {
                                "value": 0.76,
                            },
                            "controlling_check": "UR1",
                        },
                    }
                },
                "compatibility_details": [],
            },
            "user_specified": None,
        },
    }


def make_four_point_report_ready_results():
    return {
        "sling_lengths": [4.1, 4.2, 4.3, 4.4],
        "summary": {
            "lifting_points_qty": 4,
        },
        "calculation_context": {
            "units": {
                "load": "Te",
                "diameter": "mm",
                "ratio": "-",
                "utilization": "-",
                "factor": "-",
            },
            "static": {
                "hook_load": 20.0,
                "controlling_sling_load": 6.0,
            },
            "dynamic": {
                "hook_load": 25.0,
                "controlling_sling_load": 7.5,
            },
            "dnv_factors": {
                "dynamic_amplification_factor": 1.25,
            },
        },
        "optimal_combinations": {
            "conservative": {
                "overall_compatible": True,
                "warning_message": None,
                "geometric_warning": None,
                "items": [
                    {
                        "position": 0,
                        "component_type": "MasterlinkAssembly",
                        "component_id": "mla-1",
                        "utilization": 0.52,
                        "manufacturer": "Crosby",
                        "model": "A-342",
                        "wll_or_mbl": 21.5,
                    },
                    {
                        "position": 1,
                        "component_type": "WireRope",
                        "component_id": "wr-1",
                        "utilization": 0.61,
                        "configuration": "vertical",
                        "termination": "ferrule",
                        "eye_type": "hard",
                        "manufacturer": "Bridon",
                        "model": "30 mm IWRC",
                        "wll_or_mbl": 80.0,
                    },
                    {
                        "position": 2,
                        "component_type": "Shackle",
                        "component_id": "sh-1",
                        "utilization": 0.58,
                        "manufacturer": "Crosby",
                        "model": "G-2140",
                        "wll_or_mbl": 12.0,
                    },
                ],
                "component_factors": [
                    {
                        "component_type": "MasterlinkAssembly",
                        "minimum_breaking_load": 120.0,
                    },
                    {
                        "component_type": "WireRope",
                        "minimum_breaking_load": 80.0,
                    },
                    {
                        "component_type": "Shackle",
                        "minimum_breaking_load": 60.0,
                    },
                ],
                "component_traces": [
                    {
                        "meta": {
                            "position": 0,
                            "component_type": "MasterlinkAssembly",
                            "component_id": "mla-1",
                        },
                        "results": {
                            "utilization": {
                                "value": 0.52,
                            }
                        },
                    },
                    {
                        "meta": {
                            "position": 1,
                            "component_type": "WireRope",
                            "component_id": "wr-1",
                        },
                        "results": {
                            "utilization": {
                                "value": 0.61,
                            }
                        },
                    },
                    {
                        "meta": {
                            "position": 2,
                            "component_type": "Shackle",
                            "component_id": "sh-1",
                        },
                        "results": {
                            "utilization": {
                                "value": 0.58,
                            }
                        },
                    },
                ],
                "compatibility_details": [],
            }
        },
    }


# ============================================================================
# LIST TESTS
# ============================================================================

def test_designs_list_returns_only_owned_designs(auth_client, free_user, starter_user):
    """Users can only list their own designs."""
    free_project = Project.objects.create(owner=free_user, name="Free Project")
    starter_project = Project.objects.create(owner=starter_user, name="Starter Project")

    free_analysis = LiftingAnalysis.objects.create(
        project=free_project,
        name="Free Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={}
    )
    starter_analysis = LiftingAnalysis.objects.create(
        project=starter_project,
        name="Starter Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={}
    )

    RiggingDesign.objects.create(
        analysis=free_analysis,
        project=free_project,
        name="Free Design 1",
        arrangement={},
        results={}
    )
    RiggingDesign.objects.create(
        analysis=free_analysis,
        project=free_project,
        name="Free Design 2",
        arrangement={},
        results={}
    )
    RiggingDesign.objects.create(
        analysis=starter_analysis,
        project=starter_project,
        name="Starter Design",
        arrangement={},
        results={}
    )

    client = auth_client(free_user)
    response = client.get(reverse("design"))

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 2
    returned_names = {item["name"] for item in response.data}
    assert returned_names == {"Free Design 1", "Free Design 2"}


def test_designs_list_can_filter_by_analysis_id(auth_client, free_user):
    """Designs list can be filtered by analysis_id."""
    project = Project.objects.create(owner=free_user, name="Test Project")
    analysis1 = LiftingAnalysis.objects.create(
        project=project,
        name="Analysis 1",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={}
    )
    analysis2 = LiftingAnalysis.objects.create(
        project=project,
        name="Analysis 2",
        maximum_gross_weight=2000,
        location="onshore",
        lifting_points_qty=2,
        configuration={},
        results={}
    )

    RiggingDesign.objects.create(
        analysis=analysis1,
        project=project,
        name="Design for Analysis 1",
        arrangement={},
        results={}
    )
    RiggingDesign.objects.create(
        analysis=analysis2,
        project=project,
        name="Design for Analysis 2",
        arrangement={},
        results={}
    )

    client = auth_client(free_user)
    response = client.get(reverse("design"), {"analysis_id": str(analysis1.id)})

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 1
    assert response.data[0]["name"] == "Design for Analysis 1"


# ============================================================================
# CREATE TESTS - FREE TIER
# ============================================================================

def test_free_user_can_create_first_design_in_analysis(auth_client, free_user):
    """Free users can create their first design for an analysis."""
    project = Project.objects.create(owner=free_user, name="Test Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Test Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={"lifting_points_qty": 4},
        results={"required_capacity": 250}
    )

    client = auth_client(free_user)
    payload = make_design_payload(analysis.id, "First Design")
    response = client.post(reverse("design"), payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert RiggingDesign.objects.filter(analysis=analysis).count() == 1
    assert RiggingDesign.objects.filter(analysis=analysis, name="First Design").exists()


def test_create_design_returns_clear_error_for_short_custom_arrangement(auth_client, pro_user):
    project = Project.objects.create(owner=pro_user, name="Arrangement Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Arrangement Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={"lifting_points_qty": 4},
        results={"required_capacity": 250}
    )

    client = auth_client(pro_user)
    payload = make_design_payload(analysis.id, "Too Short")
    payload["user_preferences"] = [
        {"component_type": "MasterlinkAssembly"},
    ]

    with patch(
        "apps.api.v1.design.views.RiggingDesignService.run_design_for_analysis",
        side_effect=InvalidArrangementLengthError(
            "Custom arrangement must contain between 3 and 10 components. Found 1."
        ),
    ):
        response = client.post(reverse("design"), payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["error"]["message"] == "Custom arrangement must contain between 3 and 10 components. Found 1."
    assert response.data["error"]["code"] == "invalid_arrangement_length"
    assert "Rigging design computation failed" not in response.data["error"]["message"]
    assert not RiggingDesign.objects.filter(analysis=analysis, name="Too Short").exists()


def test_create_design_returns_clear_error_for_invalid_first_component(auth_client, pro_user):
    project = Project.objects.create(owner=pro_user, name="First Component Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="First Component Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={"lifting_points_qty": 4},
        results={"required_capacity": 250}
    )

    client = auth_client(pro_user)
    payload = make_design_payload(analysis.id, "Wrong First")
    payload["user_preferences"] = [
        {"component_type": "Masterlink"},
        {"component_type": "WireRope"},
        {"component_type": "Shackle"},
    ]

    with patch(
        "apps.api.v1.design.views.RiggingDesignService.run_design_for_analysis",
        side_effect=InvalidFirstComponentError(
            "Custom arrangement is invalid. For 4 lifting points, the first component must be Masterlink Assembly."
        ),
    ):
        response = client.post(reverse("design"), payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["error"]["message"] == (
        "Custom arrangement is invalid. For 4 lifting points, the first component must be Masterlink Assembly."
    )
    assert response.data["error"]["code"] == "invalid_first_component"
    assert "Rigging design computation failed" not in response.data["error"]["message"]
    assert not RiggingDesign.objects.filter(analysis=analysis, name="Wrong First").exists()


def test_create_design_returns_clear_error_for_wire_rope_last(auth_client, pro_user):
    project = Project.objects.create(owner=pro_user, name="Wire Rope Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Wire Rope Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=2,
        configuration={"lifting_points_qty": 2},
        results={"required_capacity": 250}
    )

    client = auth_client(pro_user)
    payload = make_design_payload(analysis.id, "Wire Rope Last")
    payload["user_preferences"] = [
        {"component_type": "Masterlink"},
        {"component_type": "Shackle"},
        {"component_type": "WireRope"},
    ]

    with patch(
        "apps.api.v1.design.views.RiggingDesignService.run_design_for_analysis",
        side_effect=WireRopeLastComponentError(
            "Custom arrangement is invalid. Wire Rope cannot be the last component."
        ),
    ):
        response = client.post(reverse("design"), payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["error"]["message"] == "Custom arrangement is invalid. Wire Rope cannot be the last component."
    assert response.data["error"]["code"] == "wire_rope_last_component"
    assert "Rigging design computation failed" not in response.data["error"]["message"]
    assert not RiggingDesign.objects.filter(analysis=analysis, name="Wire Rope Last").exists()


def test_create_design_returns_clear_error_for_missing_required_component(auth_client, pro_user):
    project = Project.objects.create(owner=pro_user, name="Missing Component Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Missing Component Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={"lifting_points_qty": 4},
        results={"required_capacity": 250}
    )

    client = auth_client(pro_user)
    payload = make_design_payload(analysis.id, "Missing Wire Rope")
    payload["user_preferences"] = [
        {"component_type": "MasterlinkAssembly"},
        {"component_type": "Shackle"},
        {"component_type": "Shackle"},
    ]

    with patch(
        "apps.api.v1.design.views.RiggingDesignService.run_design_for_analysis",
        side_effect=MissingRequiredComponentError(
            "Custom arrangement is incomplete. Missing required component: Wire Rope."
        ),
    ):
        response = client.post(reverse("design"), payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["error"]["message"] == "Custom arrangement is incomplete. Missing required component: Wire Rope."
    assert response.data["error"]["code"] == "missing_required_component"
    assert "Rigging design computation failed" not in response.data["error"]["message"]
    assert not RiggingDesign.objects.filter(analysis=analysis, name="Missing Wire Rope").exists()


def test_free_user_cannot_create_second_design_in_same_analysis(auth_client, free_user):
    """Free users cannot create a second design for the same analysis."""
    project = Project.objects.create(owner=free_user, name="Test Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Test Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={"lifting_points_qty": 4},
        results={"required_capacity": 250}
    )

    # Create first design
    RiggingDesign.objects.create(
        analysis=analysis,
        project=project,
        name="Existing Design",
        arrangement={},
        results={}
    )

    client = auth_client(free_user)
    payload = make_design_payload(analysis.id, "Second Design")
    response = client.post(reverse("design"), payload, format="json")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert RiggingDesign.objects.filter(analysis=analysis).count() == 1
    assert "design" in str(response.data).lower()


# ============================================================================
# CREATE TESTS - STARTER TIER
# ============================================================================

def test_starter_user_can_create_first_design_in_analysis(auth_client, starter_user):
    """Starter users can create their first design for an analysis."""
    project = Project.objects.create(owner=starter_user, name="Test Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Test Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={"lifting_points_qty": 4},
        results={"required_capacity": 250}
    )

    client = auth_client(starter_user)
    payload = make_design_payload(analysis.id, "First Design")
    response = client.post(reverse("design"), payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert RiggingDesign.objects.filter(analysis=analysis).count() == 1


def test_starter_user_cannot_create_second_design_in_same_analysis(auth_client, starter_user):
    """Starter users cannot create a second design for the same analysis (limit is 1)."""
    project = Project.objects.create(owner=starter_user, name="Test Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Test Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={"lifting_points_qty": 4},
        results={"required_capacity": 250}
    )

    # Create first design
    RiggingDesign.objects.create(
        analysis=analysis,
        project=project,
        name="Existing Design",
        arrangement={},
        results={}
    )

    client = auth_client(starter_user)
    payload = make_design_payload(analysis.id, "Second Design")
    response = client.post(reverse("design"), payload, format="json")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert RiggingDesign.objects.filter(analysis=analysis).count() == 1


# ============================================================================
# CREATE TESTS - PRO TIER
# ============================================================================

def test_pro_user_can_create_beyond_starter_limit(auth_client, pro_user):
    """Pro users can create multiple designs for the same analysis (unlimited)."""
    project = Project.objects.create(owner=pro_user, name="Test Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Test Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={"lifting_points_qty": 4},
        results={"required_capacity": 250}
    )

    # Create first design
    RiggingDesign.objects.create(
        analysis=analysis,
        project=project,
        name="First Design",
        arrangement={},
        results={}
    )

    # Pro user should be able to create a second design
    client = auth_client(pro_user)
    payload = make_design_payload(analysis.id, "Second Design")
    response = client.post(reverse("design"), payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert RiggingDesign.objects.filter(analysis=analysis).count() == 2


def test_pro_user_can_create_many_designs(auth_client, pro_user):
    """Pro users can create many designs for the same analysis."""
    project = Project.objects.create(owner=pro_user, name="Test Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Test Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={"lifting_points_qty": 4},
        results={"required_capacity": 250}
    )

    # Create 5 designs
    for i in range(5):
        RiggingDesign.objects.create(
            analysis=analysis,
            project=project,
            name=f"Design {i+1}",
            arrangement={},
            results={}
        )

    # Should still be able to create more
    client = auth_client(pro_user)
    payload = make_design_payload(analysis.id, "Sixth Design")
    response = client.post(reverse("design"), payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert RiggingDesign.objects.filter(analysis=analysis).count() == 6


# ============================================================================
# CREATE TESTS - INACTIVE SUBSCRIPTIONS
# ============================================================================

def test_inactive_starter_user_is_treated_as_free_for_design_creation(auth_client, starter_inactive_user):
    """Inactive starter users are treated as free tier (critical business rule)."""
    project = Project.objects.create(owner=starter_inactive_user, name="Test Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Test Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={"lifting_points_qty": 4},
        results={"required_capacity": 250}
    )

    # Create first design
    RiggingDesign.objects.create(
        analysis=analysis,
        project=project,
        name="Existing Design",
        arrangement={},
        results={}
    )

    client = auth_client(starter_inactive_user)
    payload = make_design_payload(analysis.id, "Second Design")
    response = client.post(reverse("design"), payload, format="json")

    # Should be blocked like a free user (1 design limit)
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert RiggingDesign.objects.filter(analysis=analysis).count() == 1


def test_inactive_pro_user_is_treated_as_free_for_design_creation(auth_client, pro_inactive_user):
    """Inactive pro users are treated as free tier."""
    project = Project.objects.create(owner=pro_inactive_user, name="Test Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Test Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={"lifting_points_qty": 4},
        results={"required_capacity": 250}
    )

    # Create first design
    RiggingDesign.objects.create(
        analysis=analysis,
        project=project,
        name="Existing Design",
        arrangement={},
        results={}
    )

    client = auth_client(pro_inactive_user)
    payload = make_design_payload(analysis.id, "Second Design")
    response = client.post(reverse("design"), payload, format="json")

    # Should be blocked like a free user (1 design limit)
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert RiggingDesign.objects.filter(analysis=analysis).count() == 1


def test_inactive_paid_user_can_still_list_existing_designs(auth_client, pro_inactive_user):
    """Inactive paid users can still view their existing designs."""
    project = Project.objects.create(owner=pro_inactive_user, name="Test Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Test Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={}
    )
    RiggingDesign.objects.create(
        analysis=analysis,
        project=project,
        name="Existing Design",
        arrangement={},
        results={}
    )

    client = auth_client(pro_inactive_user)
    response = client.get(reverse("design"))

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 1
    assert response.data[0]["name"] == "Existing Design"


# ============================================================================
# OWNERSHIP AND SECURITY TESTS
# ============================================================================

def test_user_cannot_create_design_for_another_users_analysis(auth_client, free_user, starter_user):
    """Users cannot create designs for analyses they don't own."""
    starter_project = Project.objects.create(owner=starter_user, name="Starter Project")
    starter_analysis = LiftingAnalysis.objects.create(
        project=starter_project,
        name="Starter Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={"lifting_points_qty": 4},
        results={"required_capacity": 250}
    )

    client = auth_client(free_user)
    payload = make_design_payload(starter_analysis.id, "Unauthorized Design")
    response = client.post(reverse("design"), payload, format="json")

    # Should return 400 because serializer validation checks ownership
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert RiggingDesign.objects.filter(analysis=starter_analysis).count() == 0


def test_owner_can_retrieve_own_design_detail(auth_client, free_user):
    """Users can retrieve their own design details."""
    project = Project.objects.create(owner=free_user, name="Test Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Test Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={}
    )
    design = RiggingDesign.objects.create(
        analysis=analysis,
        project=project,
        name="My Design",
        arrangement={"some": "config"},
        results={"some": "data"}
    )

    client = auth_client(free_user)
    response = client.get(reverse("design-details", kwargs={"pk": design.pk}))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["id"] == str(design.id)
    assert response.data["name"] == "My Design"


def test_user_cannot_retrieve_someone_elses_design_detail(auth_client, free_user, starter_user):
    """Users cannot retrieve other users' design details."""
    starter_project = Project.objects.create(owner=starter_user, name="Starter Project")
    starter_analysis = LiftingAnalysis.objects.create(
        project=starter_project,
        name="Starter Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={}
    )
    design = RiggingDesign.objects.create(
        analysis=starter_analysis,
        project=starter_project,
        name="Secret Design",
        arrangement={},
        results={}
    )

    client = auth_client(free_user)
    response = client.get(reverse("design-details", kwargs={"pk": design.pk}))

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_user_cannot_delete_someone_elses_design(auth_client, free_user, starter_user):
    """Users cannot delete other users' designs."""
    starter_project = Project.objects.create(owner=starter_user, name="Starter Project")
    starter_analysis = LiftingAnalysis.objects.create(
        project=starter_project,
        name="Starter Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={}
    )
    design = RiggingDesign.objects.create(
        analysis=starter_analysis,
        project=starter_project,
        name="Protected Design",
        arrangement={},
        results={}
    )

    client = auth_client(free_user)
    response = client.delete(reverse("design-details", kwargs={"pk": design.pk}))

    assert response.status_code == status.HTTP_404_NOT_FOUND
    # Design should still exist
    assert RiggingDesign.objects.filter(id=design.id).exists()


def test_owner_can_retrieve_design_report_preview(auth_client, starter_user):
    project = Project.objects.create(owner=starter_user, name="Test Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Lift 01",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=1,
        configuration={},
        results={},
    )
    profile, _ = UserProfile.objects.get_or_create(user=starter_user)
    profile.company = "Atlas Engineering"
    profile.report_prepared_by = "Report Owner"
    profile.save()

    design = RiggingDesign.objects.create(
        analysis=analysis,
        project=project,
        name="Issue Design",
        arrangement=["WireRope"],
        results=make_report_ready_results(),
    )

    client = auth_client(starter_user)
    response = client.get(reverse("design-report", kwargs={"pk": design.pk}))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["header"]["design_name"] == "Issue Design"
    assert response.data["header"]["company_name"] == "Atlas Engineering"
    assert response.data["recommendation"]["selected_title"] == "Conservative Recommendation"
    assert response.data["selected_components"]["items"][0]["component_type"] == "WireRope"
    assert "sling_length" not in response.data["selected_components"]["items"][0]
    assert response.data["selected_components"]["sling_lengths"] == [
        {
            "leg": 1,
            "length": 12.5,
            "unit": "m",
        }
    ]


def test_owner_can_select_specific_non_null_report_combination(auth_client, starter_user):
    project = Project.objects.create(owner=starter_user, name="Selectable Report Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Lift Select",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=1,
        configuration={},
        results={},
    )
    design = RiggingDesign.objects.create(
        analysis=analysis,
        project=project,
        name="Selectable Report Design",
        arrangement=["WireRope"],
        results=make_multi_combination_report_ready_results(),
    )

    client = auth_client(starter_user)
    response = client.get(
        reverse("design-report", kwargs={"pk": design.pk}),
        {"selected_key": "minimum"},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["recommendation"]["selected_key"] == "minimum"
    assert response.data["recommendation"]["selected_title"] == "Minimum Recommendation"
    assert response.data["selected_components"]["items"][0]["component_type"] == "Shackle"
    assert response.data["available_combinations"] == [
        {"key": "conservative", "title": "Conservative Recommendation"},
        {"key": "minimum", "title": "Minimum Recommendation"},
    ]


def test_design_report_preview_aligns_appendix_rows_from_list_payload(auth_client, starter_user):
    project = Project.objects.create(owner=starter_user, name="List Payload Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Two Point Lift",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=2,
        configuration={},
        results={},
    )
    design = RiggingDesign.objects.create(
        analysis=analysis,
        project=project,
        name="Two Point Design",
        arrangement=["Masterlink", "WireRope", "Shackle"],
        results=make_two_point_report_ready_results(),
    )

    client = auth_client(starter_user)
    response = client.get(reverse("design-report", kwargs={"pk": design.pk}))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["design_basis"]["loads"][0]["unit"] == "Te"
    assert [row["component_type"] for row in response.data["appendix"]["component_factors"]] == [
        "Masterlink",
        "WireRope",
        "Shackle",
    ]
    assert [row["component_id"] for row in response.data["appendix"]["component_factors"]] == [
        "6",
        "14",
        "11",
    ]
    wire_rope_fields = response.data["appendix"]["component_factors"][1]["display_values"]
    wire_rope_metadata = response.data["appendix"]["component_factors"][1]["metadata"]
    assert any(field["key"] == "minimum_breaking_load" and field["value"] == 48.11 for field in wire_rope_fields)
    assert any(field["key"] == "termination" and field["value"] == "ferrule" for field in wire_rope_fields)
    assert any(field["key"] == "eye_type" and field["value"] == "hard" for field in wire_rope_fields)
    assert all(not field["key"].endswith("_id") for field in wire_rope_fields)
    assert {field["key"] for field in wire_rope_metadata} == {"before_component_id", "after_component_id"}
    assert "sling_length" not in response.data["selected_components"]["items"][1]
    assert response.data["selected_components"]["sling_lengths"] == [
        {"leg": 1, "length": 3.605551275463989, "unit": "m"},
        {"leg": 2, "length": 3.605551275463989, "unit": "m"},
    ]
    assert response.data["governing_checks"][0]["controlling_check"] == "UR1"
    assert response.data["governing_checks"][2]["controlling_check"] == "UR2"
    component_traces = response.data["appendix"]["component_traces"]
    assert component_traces["design_parameters"]["title"] == "Design Parameters"
    assert [row["label"] for row in component_traces["design_parameters"]["rows"]] == [
        "Static Hook Load",
        "Governing Static Sling Load",
        "Dynamic Amplification Factor",
        "Dynamic Hook Load",
        "Governing Dynamic Sling Load",
    ]
    assert component_traces["components"][0]["header_title"] == "Item 1: Masterlink, Crosby A-345 17.70 Te"
    assert component_traces["components"][1]["header_title"] == "Item 2: Wire Rope, Bridon 26 mm IWRC 48.11 Te"
    assert component_traces["components"][0]["image_url"] is None
    masterlink_rows = component_traces["components"][0]["rows"]
    assert any(row["key"] == "proof_load" and row["citations"] == [{"reference_id": "1", "clause": "16.11.4"}] for row in masterlink_rows)
    assert any(row["key"] == "utilization" and row["highlight_result"] is True for row in masterlink_rows)
    shackle_rows = component_traces["components"][2]["rows"]
    assert any(row["key"] == "controlling_check" and row["value"] == "UR2" for row in shackle_rows)
    assert component_traces["references"] == [
        {
            "id": "1",
            "title": "DNV-ST-N001 Marine Operations and Marine Warranty",
        }
    ]
    assert response.data["appendix"]["compatibility_details"][0]["pair"] == "Masterlink (6) -> WireRope (14)"


def test_design_report_preview_returns_all_four_sling_lengths(auth_client, starter_user):
    project = Project.objects.create(owner=starter_user, name="Four Sling Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Four Point Lift",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={},
    )
    design = RiggingDesign.objects.create(
        analysis=analysis,
        project=project,
        name="Four Point Design",
        arrangement=["MasterlinkAssembly", "WireRope", "Shackle"],
        results=make_four_point_report_ready_results(),
    )

    client = auth_client(starter_user)
    response = client.get(reverse("design-report", kwargs={"pk": design.pk}))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["selected_components"]["sling_lengths"] == [
        {"leg": 1, "length": 4.1, "unit": "m"},
        {"leg": 2, "length": 4.2, "unit": "m"},
        {"leg": 3, "length": 4.3, "unit": "m"},
        {"leg": 4, "length": 4.4, "unit": "m"},
    ]


def test_user_cannot_retrieve_other_users_design_report_preview(auth_client, starter_user, pro_user):
    project = Project.objects.create(owner=pro_user, name="Pro Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Pro Lift",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=1,
        configuration={},
        results={},
    )
    design = RiggingDesign.objects.create(
        analysis=analysis,
        project=project,
        name="Protected Report",
        arrangement=["WireRope"],
        results=make_report_ready_results(),
    )

    client = auth_client(starter_user)
    response = client.get(reverse("design-report", kwargs={"pk": design.pk}))

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_free_user_cannot_retrieve_design_report_preview(auth_client, free_user):
    project = Project.objects.create(owner=free_user, name="Free Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Free Lift",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=1,
        configuration={},
        results={},
    )
    design = RiggingDesign.objects.create(
        analysis=analysis,
        project=project,
        name="Free Design",
        arrangement=["WireRope"],
        results=make_report_ready_results(),
    )

    client = auth_client(free_user)
    response = client.get(reverse("design-report", kwargs={"pk": design.pk}))

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_starter_inactive_user_cannot_retrieve_design_report_preview(auth_client, starter_inactive_user):
    project = Project.objects.create(owner=starter_inactive_user, name="Inactive Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Inactive Lift",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=1,
        configuration={},
        results={},
    )
    design = RiggingDesign.objects.create(
        analysis=analysis,
        project=project,
        name="Inactive Design",
        arrangement=["WireRope"],
        results=make_report_ready_results(),
    )

    client = auth_client(starter_inactive_user)
    response = client.get(reverse("design-report", kwargs={"pk": design.pk}))

    assert response.status_code == status.HTTP_403_FORBIDDEN


# ============================================================================
# DESIGN LIMITS ACROSS DIFFERENT ANALYSES
# ============================================================================

def test_free_user_limits_are_per_analysis(auth_client, free_user):
    """Free user design limits apply per analysis, not globally."""
    project = Project.objects.create(owner=free_user, name="Test Project")
    analysis1 = LiftingAnalysis.objects.create(
        project=project,
        name="Analysis 1",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={"lifting_points_qty": 4},
        results={"required_capacity": 250}
    )
    analysis2 = LiftingAnalysis.objects.create(
        project=project,
        name="Analysis 2",
        maximum_gross_weight=2000,
        location="onshore",
        lifting_points_qty=2,
        configuration={"lifting_points_qty": 2},
        results={"required_capacity": 500}
    )

    # Create design for analysis1
    RiggingDesign.objects.create(
        analysis=analysis1,
        project=project,
        name="Design for Analysis 1",
        arrangement={},
        results={}
    )

    # Should be able to create design for analysis2 (different analysis)
    client = auth_client(free_user)
    payload = make_design_payload(analysis2.id, "Design for Analysis 2")
    response = client.post(reverse("design"), payload, format="json")

    # Note: This assumes user has ability to create analysis2
    # In reality, free users can only have 1 analysis per project
    # But the business logic should still be per-analysis
    assert response.status_code == status.HTTP_201_CREATED
    assert RiggingDesign.objects.filter(analysis=analysis2).count() == 1
