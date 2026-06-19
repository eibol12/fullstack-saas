from domain.saas.types import Tier

"""
SaaS Tier Limits - Pure domain constants.
"""

TIER_LIMITS = {
    Tier.FREE: {
        'max_projects': 1,
        'max_analyses_per_project': 1,
        'max_designs_per_analysis': 1,
        'can_export_pdf': False,
        'can_use_api': False,
        'support_level': 'community',
    },
    Tier.STARTER: {
        'max_projects': 3,
        'max_analyses_per_project': 3,
        'max_designs_per_analysis': 3,
        'can_export_pdf': True,
        'can_use_api': False,
        'support_level': 'email',
    },
    Tier.PRO: {
        'max_projects': None,  # Unlimited
        'max_analyses_per_project': None,
        'max_designs_per_analysis': None,
        'can_export_pdf': True,
        'can_use_api': True,
        'support_level': 'priority',
    },
}
