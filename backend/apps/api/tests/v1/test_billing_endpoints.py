import pytest
from django.urls import reverse
from rest_framework import status

from apps.main.models import Project
from apps.billing.models import Customer


pytestmark = pytest.mark.django_db


def test_capabilities_returns_401_for_unauthenticated_request(api_client):
    """Unauthenticated users cannot access capabilities endpoint"""
    response = api_client.get(reverse("capabilities"))

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_capabilities_returns_free_tier_limits_for_free_user(auth_client, free_user):
    """Free users see correct free tier limits"""
    client = auth_client(free_user)
    response = client.get(reverse("capabilities"))

    assert response.status_code == status.HTTP_200_OK

    data = response.data
    assert data["current_tier"] == Customer.Tier.FREE
    assert data["subscription_active"] is False
    assert data["max_projects"] == 1
    assert data["max_analyses_per_project"] == 1
    assert data["max_designs_per_analysis"] == 1
    assert data["can_export_pdf"] is False
    assert data["can_use_api"] is False
    assert data["support_level"] == "community"
    assert data["current_projects"] == 0


def test_capabilities_returns_starter_tier_limits_for_active_starter_user(auth_client, starter_user):
    """Active starter users see correct starter tier limits"""
    client = auth_client(starter_user)
    response = client.get(reverse("capabilities"))

    assert response.status_code == status.HTTP_200_OK

    data = response.data
    assert data["current_tier"] == Customer.Tier.STARTER
    assert data["subscription_active"] is True
    assert data["max_projects"] == 5
    assert data["max_analyses_per_project"] == 3
    assert data["max_designs_per_analysis"] == 3
    assert data["can_export_pdf"] is True
    assert data["can_use_api"] is False
    assert data["support_level"] == "email"
    assert data["current_projects"] == 0


def test_capabilities_returns_pro_tier_limits_for_active_pro_user(auth_client, pro_user):
    """Active pro users see correct pro tier limits with unlimited values"""
    client = auth_client(pro_user)
    response = client.get(reverse("capabilities"))

    assert response.status_code == status.HTTP_200_OK

    data = response.data
    assert data["current_tier"] == Customer.Tier.PRO
    assert data["subscription_active"] is True
    assert data["max_projects"] is None  # Unlimited
    assert data["max_analyses_per_project"] is None  # Unlimited
    assert data["max_designs_per_analysis"] is None  # Unlimited
    assert data["can_export_pdf"] is True
    assert data["can_use_api"] is True
    assert data["support_level"] == "priority"
    assert data["current_projects"] == 0


def test_capabilities_treats_inactive_starter_user_as_free(auth_client, starter_inactive_user):
    """Inactive starter users are treated as free tier (critical business rule)"""
    client = auth_client(starter_inactive_user)
    response = client.get(reverse("capabilities"))

    assert response.status_code == status.HTTP_200_OK

    data = response.data
    # Effective tier should be FREE even though customer.tier = STARTER
    assert data["current_tier"] == Customer.Tier.FREE
    assert data["subscription_active"] is False
    assert data["max_projects"] == 1
    assert data["max_analyses_per_project"] == 1
    assert data["max_designs_per_analysis"] == 1
    assert data["can_export_pdf"] is False
    assert data["can_use_api"] is False
    assert data["support_level"] == "community"


def test_capabilities_treats_inactive_pro_user_as_free(auth_client, pro_inactive_user):
    """Inactive pro users are treated as free tier"""
    client = auth_client(pro_inactive_user)
    response = client.get(reverse("capabilities"))

    assert response.status_code == status.HTTP_200_OK

    data = response.data
    # Effective tier should be FREE even though customer.tier = PRO
    assert data["current_tier"] == Customer.Tier.FREE
    assert data["subscription_active"] is False
    assert data["max_projects"] == 1
    assert data["can_export_pdf"] is False
    assert data["can_use_api"] is False


def test_capabilities_includes_accurate_current_project_count(auth_client, free_user):
    """Current project count is accurate and reflects actual usage"""
    # Create some projects
    Project.objects.create(owner=free_user, name="Project 1")
    Project.objects.create(owner=free_user, name="Project 2")

    client = auth_client(free_user)
    response = client.get(reverse("capabilities"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["current_projects"] == 2


def test_capabilities_project_count_only_includes_own_projects(auth_client, free_user, starter_user):
    """Current project count only includes authenticated user's projects"""
    Project.objects.create(owner=free_user, name="Free Project 1")
    Project.objects.create(owner=free_user, name="Free Project 2")
    Project.objects.create(owner=starter_user, name="Starter Project")

    client = auth_client(free_user)
    response = client.get(reverse("capabilities"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["current_projects"] == 2  # Only free_user's projects


def test_capabilities_for_user_without_customer_record_defaults_to_free(auth_client, db):
    """Users without a Customer record default to free tier"""
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # Create user without customer record
    user = User.objects.create_user(
        username="nocustomer@example.com",
        email="nocustomer@example.com",
        password="testpass123"
    )

    client = auth_client(user)
    response = client.get(reverse("capabilities"))

    assert response.status_code == status.HTTP_200_OK

    data = response.data
    assert data["current_tier"] == Customer.Tier.FREE
    assert data["subscription_active"] is False
    assert data["max_projects"] == 1
    assert data["current_projects"] == 0
