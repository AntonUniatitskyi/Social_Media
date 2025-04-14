from django.urls import path
from .views import *

urlpatterns = [
    path('', chat_list, name='chat_list'),
    path('chat-pub', chat_view, name='chat_home'),
    path('chat/<username>', get_or_create_chatroom, name='start-chat'),
    path('chat/room/<chatroom_name>', chat_view, name='chatroom'),

]