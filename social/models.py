from django.db import models
from django.contrib.auth.models import User

# Create your models here.


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    uusername = models.CharField(blank=True, null=True, max_length=200, unique=True)
    bio = models.TextField(blank=True, null=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    followers = models.ManyToManyField(User, related_name='following_profiles', blank=True)

    def __str__(self): return f"Профиль пользователя {self.user.username}"
    def followers_count(self): return self.followers.count()
    def following_count(self): return Profile.objects.filter(followers=self.user).count()
    def is_following(self, target_user): return self.user in target_user.profile.followers.all()
    def publications_count(self):
        return self.publications.count()

class Publication(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='publications')
    # media = models.FileField(upload_to='publications/', blank=True, null=True)
    likes = models.ManyToManyField(User, related_name='liked_publications', blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    text = models.TextField(blank=True, null=True)

    def likes_count(self):
        return self.likes.count()

    def is_liked_by(self, user):
        return self.likes.filter(id=user.id).exists()

    def __str__(self):
        return f"Публикация от {self.profile.user.username}"
    

class Comment(models.Model):
    publication = models.ForeignKey(Publication, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='user_comment')
    text_com = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    

class MediaItem(models.Model):
    publication = models.ForeignKey(Publication, on_delete=models.CASCADE, related_name='media_items')
    file = models.FileField(upload_to='publications/')

    def is_image(self):
        return self.file.name.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))

    def is_video(self):
        return self.file.name.lower().endswith(('.mp4', '.mov', '.avi', '.mkv'))