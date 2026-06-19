import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.billing.models import Customer
from apps.main.models import Project, LiftingAnalysis

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


def make_user(email="test@example.com", password="testpass123"):
    return User.objects.create_user(
        username=email,
        email=email,
        password=password,
    )


def configure_customer(user, tier, subscription_active=False):
    customer, _ = Customer.objects.get_or_create(user=user)
    customer.tier = tier
    customer.subscription_active = subscription_active
    customer.save()
    return customer


@pytest.fixture
def free_user(db):
    user = make_user("free@example.com")
    configure_customer(user, Customer.Tier.FREE, subscription_active=False)
    return user


@pytest.fixture
def starter_user(db):
    user = make_user("starter@example.com")
    configure_customer(user, Customer.Tier.STARTER, subscription_active=True)
    return user


@pytest.fixture
def starter_inactive_user(db):
    user = make_user("starter_inactive@example.com")
    configure_customer(user, Customer.Tier.STARTER, subscription_active=False)
    return user


@pytest.fixture
def pro_user(db):
    user = make_user("pro@example.com")
    configure_customer(user, Customer.Tier.PRO, subscription_active=True)
    return user


@pytest.fixture
def pro_inactive_user(db):
    user = make_user("pro_inactive@example.com")
    configure_customer(user, Customer.Tier.PRO, subscription_active=False)
    return user


@pytest.fixture
def auth_client():
    def _auth(user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client
    return _auth


def make_project(owner, name="Project A"):
    return Project.objects.create(owner=owner, name=name)


def make_analysis(project, name="Analysis A"):
    return LiftingAnalysis.objects.create(
        project=project,
        name=name,
        maximum_gross_weight=1000,
        location="offshore",
        lifting_points_qty=4,
        configuration={},
        results={},
    )