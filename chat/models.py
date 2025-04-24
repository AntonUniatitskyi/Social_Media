from django.db import models
from django.contrib.auth.models import User
import shortuuid
import os
from PIL import Image

# Create your models here.
class ChatGroup(models.Model):
    group_name = models.CharField(max_length=128, unique=True, default=shortuuid.uuid)
    group_chat_name = models.CharField(max_length=128, null=True, blank=True)
    admin = models.ForeignKey(User, related_name='groupschat', blank=True, null=True, on_delete=models.SET_NULL)
    users_online = models.ManyToManyField(User, related_name='online_in_groups', blank=True)
    members = models.ManyToManyField(User, related_name='chat_groups', blank=True)
    is_private = models.BooleanField(default=False)

    def __str__(self):
        return f'{self.group_name}'
    
class GroupMessage(models.Model):
    group = models.ForeignKey(ChatGroup, related_name='chat_messages', on_delete=models.CASCADE)
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    body = models.CharField(max_length=400, blank=True, null=True)
    file = models.FileField(upload_to='files/', blank=True, null=True)
    created = models.DateTimeField(auto_now_add=True)

    @property
    def filename(self):
        if self.file:
            return os.path.basename(self.file.name)
        else:
            return None

    def __str__(self):
        if self.body:
            return f'{self.author.username}: {self.body}'
        elif self.file:
            return f'{self.author.username}: {self.filename}'
    
    class Meta:
        ordering = ['-created']
    
    @property
    def is_image(self):
        # if self.filename.lover().endswith(('.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp')):
        #     return True
        # else:
        #     return False
        try:
            image = Image.open(self.file)
            image.verify()
            return True
        except:
            return False

class ChatInvitation(models.Model):
    from_user = models.ForeignKey(User, related_name='sent_invites', on_delete=models.CASCADE)
    to_user = models.ForeignKey(User, related_name='received_invites', on_delete=models.CASCADE)
    chat_group = models.ForeignKey(ChatGroup, on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now_add=True)
    accepted = models.BooleanField(null=True)

    class Meta:
        unique_together = ('to_user', 'chat_group')
