import pytest
from django.urls import reverse
from rest_framework import status

from apps.main.models import Project, LiftingAnalysis


pytestmark = pytest.mark.django_db


# Helper to create valid analysis payload
def make_analysis_payload(project_id, name="Test Analysis"):
    """Create a valid analysis request payload."""
    return {
        "name": name,
        "project_id": str(project_id),
        "maximum_gross_weight": 1000.0,
        "location": "offshore",
        "lifting_points_qty": 4,
        "configuration": {
            "lifting_points_qty": 4,
            "cog_offset_x": 0.0,
            "cog_offset_y": 0.0,
        }
    }


# ============================================================================
# LIST TESTS
# ============================================================================

def test_analyses_list_returns_only_owned_analyses(auth_client, free_user, starter_user):
    """Users can only list their own analyses."""
    free_project = Project.objects.create(owner=free_user, name="Free Project")
    starter_project = Project.objects.create(owner=starter_user, name="Starter Project")

    LiftingAnalysis.objects.create(
        project=free_project,
        name="Free Analysis 1",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={}
    )
    LiftingAnalysis.objects.create(
        project=free_project,
        name="Free Analysis 2",
        maximum_gross_weight=2000,
        location="onshore",
        lifting_points_qty=2,
        configuration={},
        results={}
    )
    LiftingAnalysis.objects.create(
        project=starter_project,
        name="Starter Analysis",
        maximum_gross_weight=1500,
        location="offshore",
        lifting_points_qty=3,
        configuration={},
        results={}
    )

    client = auth_client(free_user)
    response = client.get(reverse("analyses"))

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 2
    returned_names = {item["name"] for item in response.data}
    assert returned_names == {"Free Analysis 1", "Free Analysis 2"}


def test_analyses_list_can_filter_by_project_id(auth_client, free_user):
    """Analyses list can be filtered by project_id."""
    project1 = Project.objects.create(owner=free_user, name="Project 1")
    project2 = Project.objects.create(owner=free_user, name="Project 2")

    LiftingAnalysis.objects.create(
        project=project1,
        name="Analysis 1",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={}
    )
    LiftingAnalysis.objects.create(
        project=project2,
        name="Analysis 2",
        maximum_gross_weight=2000,
        location="onshore",
        lifting_points_qty=2,
        configuration={},
        results={}
    )

    client = auth_client(free_user)
    response = client.get(reverse("analyses"), {"project_id": str(project1.id)})

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 1
    assert response.data[0]["name"] == "Analysis 1"


# ============================================================================
# CREATE TESTS - FREE TIER
# ============================================================================

def test_free_user_can_create_first_analysis_in_project(auth_client, free_user):
    """Free users can create their first analysis in a project."""
    project = Project.objects.create(owner=free_user, name="Test Project")
    client = auth_client(free_user)

    payload = make_analysis_payload(project.id, "First Analysis")
    response = client.post(reverse("analyses"), payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert LiftingAnalysis.objects.filter(project=project).count() == 1
    assert LiftingAnalysis.objects.filter(project=project, name="First Analysis").exists()


def test_free_user_cannot_create_second_analysis_in_same_project(auth_client, free_user):
    """Free users cannot create a second analysis in the same project."""
    project = Project.objects.create(owner=free_user, name="Test Project")

    # Create first analysis
    LiftingAnalysis.objects.create(
        project=project,
        name="Existing Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={}
    )

    client = auth_client(free_user)
    payload = make_analysis_payload(project.id, "Second Analysis")
    response = client.post(reverse("analyses"), payload, format="json")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert LiftingAnalysis.objects.filter(project=project).count() == 1
    assert "analysis" in str(response.data).lower() or "analyses" in str(response.data).lower()


# ============================================================================
# CREATE TESTS - STARTER TIER
# ============================================================================

def test_starter_user_can_create_up_to_three_analyses_in_project(auth_client, starter_user):
    """Starter users can create up to 3 analyses per project."""
    project = Project.objects.create(owner=starter_user, name="Test Project")

    # Create 2 existing analyses
    for i in range(2):
        LiftingAnalysis.objects.create(
            project=project,
            name=f"Analysis {i+1}",
            maximum_gross_weight=1000,
            location="offshore",
            lifting_points_qty=4,
            configuration={},
            results={}
        )

    client = auth_client(starter_user)
    payload = make_analysis_payload(project.id, "Third Analysis")
    response = client.post(reverse("analyses"), payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert LiftingAnalysis.objects.filter(project=project).count() == 3


def test_starter_user_cannot_create_fourth_analysis_in_same_project(auth_client, starter_user):
    """Starter users cannot create a 4th analysis in the same project."""
    project = Project.objects.create(owner=starter_user, name="Test Project")

    # Create 3 existing analyses
    for i in range(3):
        LiftingAnalysis.objects.create(
            project=project,
            name=f"Analysis {i+1}",
            maximum_gross_weight=1000,
            location="offshore",
            lifting_points_qty=4,
            configuration={},
            results={}
        )

    client = auth_client(starter_user)
    payload = make_analysis_payload(project.id, "Fourth Analysis")
    response = client.post(reverse("analyses"), payload, format="json")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert LiftingAnalysis.objects.filter(project=project).count() == 3


# ============================================================================
# CREATE TESTS - PRO TIER
# ============================================================================

def test_pro_user_can_create_beyond_starter_limit(auth_client, pro_user):
    """Pro users can create beyond the starter limit (unlimited)."""
    project = Project.objects.create(owner=pro_user, name="Test Project")

    # Create 3 existing analyses (starter limit)
    for i in range(3):
        LiftingAnalysis.objects.create(
            project=project,
            name=f"Analysis {i+1}",
            maximum_gross_weight=1000,
            location="offshore",
            lifting_points_qty=4,
            configuration={},
            results={}
        )

    client = auth_client(pro_user)
    payload = make_analysis_payload(project.id, "Fourth Analysis")
    response = client.post(reverse("analyses"), payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert LiftingAnalysis.objects.filter(project=project).count() == 4


# ============================================================================
# CREATE TESTS - INACTIVE SUBSCRIPTIONS
# ============================================================================

def test_inactive_starter_user_is_treated_as_free_for_analysis_creation(auth_client, starter_inactive_user):
    """Inactive starter users are treated as free tier (critical business rule)."""
    project = Project.objects.create(owner=starter_inactive_user, name="Test Project")

    # Create first analysis
    LiftingAnalysis.objects.create(
        project=project,
        name="Existing Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={}
    )

    client = auth_client(starter_inactive_user)
    payload = make_analysis_payload(project.id, "Second Analysis")
    response = client.post(reverse("analyses"), payload, format="json")

    # Should be blocked like a free user (1 analysis limit)
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert LiftingAnalysis.objects.filter(project=project).count() == 1


def test_inactive_pro_user_is_treated_as_free_for_analysis_creation(auth_client, pro_inactive_user):
    """Inactive pro users are treated as free tier."""
    project = Project.objects.create(owner=pro_inactive_user, name="Test Project")

    # Create first analysis
    LiftingAnalysis.objects.create(
        project=project,
        name="Existing Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={}
    )

    client = auth_client(pro_inactive_user)
    payload = make_analysis_payload(project.id, "Second Analysis")
    response = client.post(reverse("analyses"), payload, format="json")

    # Should be blocked like a free user (1 analysis limit)
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert LiftingAnalysis.objects.filter(project=project).count() == 1


def test_inactive_paid_user_can_still_list_existing_analyses(auth_client, pro_inactive_user):
    """Inactive paid users can still view their existing analyses."""
    project = Project.objects.create(owner=pro_inactive_user, name="Test Project")
    LiftingAnalysis.objects.create(
        project=project,
        name="Existing Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={}
    )

    client = auth_client(pro_inactive_user)
    response = client.get(reverse("analyses"))

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 1
    assert response.data[0]["name"] == "Existing Analysis"


# ============================================================================
# OWNERSHIP AND SECURITY TESTS
# ============================================================================

def test_user_cannot_create_analysis_in_another_users_project(auth_client, free_user, starter_user):
    """Users cannot create analyses in projects they don't own."""
    starter_project = Project.objects.create(owner=starter_user, name="Starter Project")

    client = auth_client(free_user)
    payload = make_analysis_payload(starter_project.id, "Unauthorized Analysis")
    response = client.post(reverse("analyses"), payload, format="json")

    # Should return 404 because the project lookup filters by owner
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert LiftingAnalysis.objects.filter(project=starter_project).count() == 0


def test_owner_can_retrieve_own_analysis_detail(auth_client, free_user):
    """Users can retrieve their own analysis details."""
    project = Project.objects.create(owner=free_user, name="Test Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="My Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={"some": "data"}
    )

    client = auth_client(free_user)
    response = client.get(reverse("analysis-details", kwargs={"pk": analysis.pk}))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["id"] == str(analysis.id)
    assert response.data["name"] == "My Analysis"


def test_user_cannot_retrieve_someone_elses_analysis_detail(auth_client, free_user, starter_user):
    """Users cannot retrieve other users' analysis details."""
    starter_project = Project.objects.create(owner=starter_user, name="Starter Project")
    analysis = LiftingAnalysis.objects.create(
        project=starter_project,
        name="Secret Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={}
    )

    client = auth_client(free_user)
    response = client.get(reverse("analysis-details", kwargs={"pk": analysis.pk}))

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_user_cannot_delete_someone_elses_analysis(auth_client, free_user, starter_user):
    """Users cannot delete other users' analyses."""
    starter_project = Project.objects.create(owner=starter_user, name="Starter Project")
    analysis = LiftingAnalysis.objects.create(
        project=starter_project,
        name="Protected Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={}
    )

    client = auth_client(free_user)
    response = client.delete(reverse("analysis-details", kwargs={"pk": analysis.pk}))

    assert response.status_code == status.HTTP_404_NOT_FOUND
    # Analysis should still exist
    assert LiftingAnalysis.objects.filter(id=analysis.id).exists()


# ============================================================================
# ANALYSIS LIMITS ACROSS DIFFERENT PROJECTS
# ============================================================================

def test_free_user_limits_are_per_project(auth_client, free_user):
    """Free user analysis limits apply per project, not globally."""
    project1 = Project.objects.create(owner=free_user, name="Project 1")
    project2 = Project.objects.create(owner=free_user, name="Project 2")

    # Create first analysis in project1
    LiftingAnalysis.objects.create(
        project=project1,
        name="Analysis in Project 1",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={}
    )

    # Should be able to create first analysis in project2
    client = auth_client(free_user)
    payload = make_analysis_payload(project2.id, "Analysis in Project 2")
    response = client.post(reverse("analyses"), payload, format="json")

    # Note: This test assumes user has ability to create project2
    # In reality, free users can only have 1 project, so this is theoretical
    # But the business logic should still be per-project
    # If the user somehow had 2 projects, they should be able to create 1 analysis in each
    assert response.status_code == status.HTTP_201_CREATED
    assert LiftingAnalysis.objects.filter(project=project2).count() == 1
