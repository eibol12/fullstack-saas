from django.contrib import admin

from apps.main.models import Shackle, Masterlink, WireRope, SlingConfiguration, Thimble, Project, LiftingAnalysis, RiggingDesign

# Register your models here.
admin.site.register(Shackle)
admin.site.register(Masterlink)
admin.site.register(WireRope)
admin.site.register(SlingConfiguration)
admin.site.register(Thimble)
admin.site.register(Project)
admin.site.register(LiftingAnalysis)
admin.site.register(RiggingDesign)