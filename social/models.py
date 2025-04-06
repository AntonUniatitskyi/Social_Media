from django.db import models
from django.contrib.auth.models import User

# Create your models here.


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    bio = models.TextField(blank=True, null=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    birth_date = models.DateField(blank=True, null=True)
    followers = models.ManyToManyField(User, related_name='following_profiles', blank=True)  # Подписчики

    def __str__(self): return f"Профиль пользователя {self.user.username}"
    def followers_count(self): return self.followers.count()
    def following_count(self): return Profile.objects.filter(followers=self.user).count()
    def is_following(self, target_user): return self.user in target_user.profile.followers.all()