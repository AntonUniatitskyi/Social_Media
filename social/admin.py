from django.contrib import admin
from . import models

# Register your models here.
admin.site.register(models.Profile)
admin.site.register(models.Comment)
admin.site.register(models.Publication)
admin.site.register(models.Complaint)