import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status

from apps.main.models import UserProfile


pytestmark = pytest.mark.django_db


def test_me_returns_profile_payload(auth_client, free_user):
    profile, _ = UserProfile.objects.get_or_create(user=free_user)
    profile.company = "Atlas Marine"
    profile.report_prepared_by = "Lead Engineer"
    profile.save()

    client = auth_client(free_user)
    response = client.get(reverse("me"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["email"] == free_user.email
    assert response.data["profile"]["company"] == "Atlas Marine"
    assert response.data["profile"]["report_prepared_by"] == "Lead Engineer"


def test_me_patch_updates_branding_and_logo(auth_client, free_user, settings):
    settings.MEDIA_ROOT = settings.BASE_DIR / "test_media"

    client = auth_client(free_user)
    logo = SimpleUploadedFile(
        "company-logo.svg",
        b"<svg xmlns='http://www.w3.org/2000/svg'></svg>",
        content_type="image/svg+xml",
    )

    response = client.patch(
        reverse("me"),
        {
            "first_name": "Ada",
            "last_name": "Lovelace",
            "company": "Rig Works",
            "report_prepared_by": "Ada Lovelace",
            "company_logo": logo,
        },
        format="multipart",
    )

    assert response.status_code == status.HTTP_200_OK

    free_user.refresh_from_db()
    profile = free_user.profile

    assert free_user.first_name == "Ada"
    assert free_user.last_name == "Lovelace"
    assert profile.company == "Rig Works"
    assert profile.report_prepared_by == "Ada Lovelace"
    assert bool(profile.company_logo)
    assert response.data["profile"]["company_logo_url"] is not None
