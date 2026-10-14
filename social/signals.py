from django.db.models.signals import post_save, post_migrate
from django.dispatch import receiver
from django.contrib.auth.models import User, Group
from .models import Profile

@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created and not kwargs.get("raw"):
        Profile.objects.create(user=instance)

@receiver(post_migrate)
def create_default_groups(sender, **kwargs):
    if sender.name != "social":
        return
    Group.objects.get_or_create(name="Адміністратор")
    Group.objects.get_or_create(name="Користувач")