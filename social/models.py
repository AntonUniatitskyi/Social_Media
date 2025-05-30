from django.db import models
from django.contrib.auth.models import User
# Create your models here.


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    uusername = models.CharField(max_length=30, unique=True, null=False, blank=False)
    bio = models.TextField(blank=True, null=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True, default='avatars/default-avatar.png')
    followers = models.ManyToManyField(User, related_name='following_profiles', blank=True)

    def __str__(self): return f"Профиль пользователя {self.user.username}"
    def followers_count(self): return self.followers.count()
    def following_count(self): return Profile.objects.filter(followers=self.user).count()
    def is_following(self, target_user): return self.user in target_user.profile.followers.all()
    def publications_count(self):
        return self.publications.count()

    def save(self, *args, **kwargs):
        if not self.uusername and self.user:
            self.uusername = self.user.username.lower()
        super().save(*args, **kwargs)

    def get_avatar_url(self):
        if self.avatar and hasattr(self.avatar, 'url'):
            return self.avatar.url
        return '/media/avatars/default-avatar.png'

class Publication(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='publications')
    saved = models.ManyToManyField(User, related_name='saved_publications', blank=True)
    likes = models.ManyToManyField(User, related_name='liked_publications', blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    text = models.TextField(blank=True, null=True)

    def likes_count(self):
        return self.likes.count()

    def is_liked_by(self, user):
        return self.likes.filter(id=user.id).exists()

    def is_saved_by(self, user):
        return self.saved.filter(id=user.id).exists()

    def __str__(self):
        return f"Публикация от {self.profile.user.username}"


class Comment(models.Model):
    publication = models.ForeignKey(Publication, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='user_comment')
    text_com = models.TextField(null=False)
    created_at = models.DateTimeField(auto_now_add=True)


class MediaItem(models.Model):
    publication = models.ForeignKey(Publication, on_delete=models.CASCADE, related_name='media_items', null=False, blank=False)
    file = models.FileField(upload_to='publications/')

    def is_image(self):
        return self.file.name.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))

    def is_video(self):
        return self.file.name.lower().endswith(('.mp4', '.mov', '.avi', '.mkv'))


class Notification(models.Model):
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Уведомление для {self.recipient.username} от {self.sender.username}"

class Complaint(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    publication = models.ForeignKey(Publication, on_delete=models.CASCADE)
    reason = models.CharField(max_length=100)
    text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    accepted = models.BooleanField(default=None, null=True)

    def __str__(self):
        return f"Complaint by {self.user.username} on {self.publication.id}"

    def accept_complaint(self):
        self.accepted = True
        self.save()

        try:
            self.publication.delete()
        except Exception as e:
            print(f"Помилка при видаленні: {e}")

    def reject_complaint(self):
        self.accepted = False
        self.save()
