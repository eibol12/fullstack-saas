from typing import Dict, Any, Optional
import logging
from django.db.models import QuerySet, Count, Prefetch
from .models import Project, LiftingAnalysis, RiggingDesign

logger = logging.getLogger("main.selectors")

class ProjectSelector:
    @staticmethod
    def get_projects_for_user(user) -> QuerySet[Project]:
        return Project.objects.filter(owner=user).order_by('-created_at')

    @staticmethod
    def get_project_detail_queryset(user) -> QuerySet[Project]:
        return Project.objects.filter(owner=user).annotate(
            analyses_count=Count("analyses", distinct=True)
        ).prefetch_related("analyses")

    @staticmethod
    def get_dashboard_rows(user) -> QuerySet[Project]:
        """
        Prefetched queryset feeding the centralized dashboard table.

        Returns every project owned by `user` with its analyses and, for
        each analysis, its rigging designs already loaded — so the view
        layer can serialize a hierarchical Project → Analyses → Designs
        payload in a single query plan (no N+1).
        """
        designs_qs = RiggingDesign.objects.order_by("-version", "-updated_at")
        analyses_qs = (
            LiftingAnalysis.objects
            .order_by("-updated_at")
            .prefetch_related(Prefetch("designs", queryset=designs_qs))
        )
        return (
            Project.objects
            .filter(owner=user)
            .order_by("-updated_at")
            .prefetch_related(Prefetch("analyses", queryset=analyses_qs))
        )

class LiftingAnalysisSelector:
    @staticmethod
    def get_analyses_for_user(user, project_id: Optional[Any] = None) -> QuerySet[LiftingAnalysis]:
        qs = LiftingAnalysis.objects.filter(project__owner=user).select_related('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs.order_by('-created_at')

    @staticmethod
    def get_analysis_queryset(user) -> QuerySet[LiftingAnalysis]:
        return LiftingAnalysis.objects.select_related('project').filter(
            project__owner=user
        )

class RiggingSelector:
    @staticmethod
    def get_designs_for_user(
        user, 
        analysis_id: Optional[Any] = None, 
        project_id: Optional[Any] = None
    ) -> QuerySet[RiggingDesign]:
        qs = RiggingDesign.objects.filter(
            project__owner=user
        ).select_related('analysis', 'project')
        
        if analysis_id:
            qs = qs.filter(analysis_id=analysis_id)
        if project_id:
            qs = qs.filter(project_id=project_id)
            
        return qs.order_by('-created_at')

    @staticmethod
    def get_design_queryset(user) -> QuerySet[RiggingDesign]:
        return RiggingDesign.objects.select_related('analysis', 'project').filter(
            project__owner=user
        )
