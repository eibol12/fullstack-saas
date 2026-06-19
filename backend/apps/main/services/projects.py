from django.db import transaction
from apps.main.models import Project

class ProjectService:
    @staticmethod
    @transaction.atomic
    def create_project(owner, name: str, description: str = "") -> Project:
        """Create a new project for a user."""
        return Project.objects.create(
            owner=owner,
            name=name,
            description=description
        )

    @staticmethod
    @transaction.atomic
    def update_project(project: Project, **data) -> Project:
        """Update an existing project."""
        for attr, value in data.items():
            setattr(project, attr, value)
        
        project.full_clean()
        project.save()
        return project

    @staticmethod
    @transaction.atomic
    def delete_project(project: Project) -> None:
        """Delete a project."""
        project.delete()
