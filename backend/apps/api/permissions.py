import logging
from rest_framework.permissions import BasePermission

logger = logging.getLogger(__name__)

class IsOwner(BasePermission):
    owner_field = "user"

    def has_object_permission(self, request, view, obj):
        owner = getattr(obj, self.owner_field, None)
        has_perm = owner is not None and owner == request.user

        if not has_perm:
            user_id = str(request.user.id) if request.user and hasattr(request.user, "id") else None
            
            owner_id = None
            if owner is not None:
                owner_id = str(owner.id) if hasattr(owner, "id") else str(owner)
                
            object_id = None
            if obj is not None:
                object_id = str(obj.id) if hasattr(obj, "id") else (str(obj.pk) if hasattr(obj, "pk") else None)
            object_type = obj.__class__.__name__ if obj else None

            logger.warning(
                "Permission check failed: User is not the owner of the object",
                extra={
                    "user_id": user_id,
                    "owner_id": owner_id,
                    "object_id": object_id,
                    "object_type": object_type,
                }
            )

        return has_perm