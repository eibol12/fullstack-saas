from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.main.models import UserProfile


User = get_user_model()


@receiver(post_save, sender=User)
def create_profile_on_user_create(sender, instance, created, **kwargs):
    """Ensure every user has a lightweight profile for report branding."""
    if not created:
        return

    UserProfile.objects.get_or_create(user=instance)
