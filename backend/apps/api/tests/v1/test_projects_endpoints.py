import pytest
from django.urls import reverse
from rest_framework import status

from apps.main.models import LiftingAnalysis, Project


pytestmark = pytest.mark.django_db


def test_projects_list_returns_only_owned_projects(auth_client, free_user, starter_user):
    Project.objects.create(owner=free_user, name="Free Project 1")
    Project.objects.create(owner=free_user, name="Free Project 2")
    Project.objects.create(owner=starter_user, name="Starter Project")

    client = auth_client(free_user)
    response = client.get(reverse("project"))

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 2
    returned_names = {item["name"] for item in response.data}
    assert returned_names == {"Free Project 1", "Free Project 2"}


def test_free_user_can_create_first_project(auth_client, free_user):
    client = auth_client(free_user)

    response = client.post(
        reverse("project"),
        {"name": "Project 1", "description": "Test project"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert Project.objects.filter(owner=free_user).count() == 1
    assert Project.objects.filter(owner=free_user, name="Project 1").exists()


def test_free_user_cannot_create_second_project(auth_client, free_user):
    Project.objects.create(owner=free_user, name="Existing Project")
    client = auth_client(free_user)

    response = client.post(
        reverse("project"),
        {"name": "Project 2", "description": "Blocked project"},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert Project.objects.filter(owner=free_user).count() == 1
    assert "project" in str(response.data).lower()


def test_starter_user_can_create_fifth_project_but_not_sixth(auth_client, starter_user):
    for i in range(4):
        Project.objects.create(owner=starter_user, name=f"Project {i+1}")

    client = auth_client(starter_user)

    response = client.post(
        reverse("project"),
        {"name": "Project 5", "description": "Allowed fifth"},
        format="json",
    )

    from apps.billing.models import Customer

    customer = Customer.objects.get(user=starter_user)

    assert response.status_code == status.HTTP_201_CREATED
    assert Project.objects.filter(owner=starter_user).count() == 5

    response = client.post(
        reverse("project"),
        {"name": "Project 6", "description": "Blocked sixth"},
        format="json",
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert Project.objects.filter(owner=starter_user).count() == 5


def test_pro_user_can_create_beyond_starter_limit(auth_client, pro_user):
    for i in range(5):
        Project.objects.create(owner=pro_user, name=f"Project {i+1}")

    client = auth_client(pro_user)
    response = client.post(
        reverse("project"),
        {"name": "Project 6", "description": "Pro allowed"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert Project.objects.filter(owner=pro_user).count() == 6


def test_inactive_starter_user_is_treated_as_free_for_project_creation(auth_client, starter_inactive_user):
    Project.objects.create(owner=starter_inactive_user, name="Existing Project")
    client = auth_client(starter_inactive_user)

    response = client.post(
        reverse("project"),
        {"name": "Second Project", "description": "Should be blocked"},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert Project.objects.filter(owner=starter_inactive_user).count() == 1


def test_inactive_pro_user_is_treated_as_free_for_project_creation(auth_client, pro_inactive_user):
    Project.objects.create(owner=pro_inactive_user, name="Existing Project")
    client = auth_client(pro_inactive_user)

    response = client.post(
        reverse("project"),
        {"name": "Second Project", "description": "Should be blocked"},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert Project.objects.filter(owner=pro_inactive_user).count() == 1


def test_inactive_paid_user_can_still_list_existing_projects(auth_client, pro_inactive_user):
    Project.objects.create(owner=pro_inactive_user, name="Existing Project")
    client = auth_client(pro_inactive_user)

    response = client.get(reverse("project"))

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 1
    assert response.data[0]["name"] == "Existing Project"


def test_owner_can_retrieve_own_project_detail(auth_client, free_user):
    project = Project.objects.create(owner=free_user, name="Owned Project")
    client = auth_client(free_user)

    response = client.get(reverse("project-details", kwargs={"pk": project.pk}))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["id"] == str(project.id)
    assert response.data["name"] == "Owned Project"


def test_project_detail_includes_analysis_updated_at(auth_client, free_user):
    project = Project.objects.create(owner=free_user, name="Owned Project")
    analysis = LiftingAnalysis.objects.create(
        project=project,
        name="Recent Analysis",
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=3,
        configuration={"lifting_points_qty": 3},
        results={},
    )

    client = auth_client(free_user)
    response = client.get(reverse("project-details", kwargs={"pk": project.pk}))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["analyses_count"] == 1
    assert response.data["analyses"][0]["id"] == str(analysis.id)
    assert "updated_at" in response.data["analyses"][0]


def test_user_cannot_retrieve_someone_elses_project_detail(auth_client, free_user, starter_user):
    project = Project.objects.create(owner=starter_user, name="Starter Secret Project")
    client = auth_client(free_user)

    response = client.get(reverse("project-details", kwargs={"pk": project.pk}))

    assert response.status_code == status.HTTP_404_NOT_FOUND
