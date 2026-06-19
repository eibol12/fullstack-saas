"""
Signals for automatic creation and updates of user-related entities.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from apps.billing.services import CustomerService as customer_service
import logging

logger = logging.getLogger(__name__)

User = get_user_model()

@receiver(post_save, sender=User)
def create_customer_on_user_create(sender, instance, created, **kwargs):
    """
    Signal to create modern Customer
    when a new User is created.
    """
    if not created:
        return
    customer_service.create_customer(instance)

