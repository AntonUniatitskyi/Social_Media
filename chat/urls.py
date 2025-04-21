from django.urls import path
from .views import *

urlpatterns = [
    path('', chat_list, name='chat_list'),
    path('chat-pub', chat_view, name='chat_home'),
    path('chat/<username>', get_or_create_chatroom, name='start-chat'),
    path('chat/room/<chatroom_name>', chat_view, name='chatroom'),
    path('new-groupchat', create_groupchat, name='new_groupchat'),
    path('edit-chatroom/<chatroom_name>', chatroom_edit_view, name='edit_chatroom'),
    path('chatroom-delete/<chatroom_name>', chatroom_delete_view ,name='chatroom_delete'),
    path('chatroom-leave/<chatroom_name>', chatroom_leave_view, name='chatroom_leave'),
    path('chat/favorites/', favorites_chat_view, name='favorites_chat'),
    # path('invite/', send_invite_view, name='send_invite')
    path('chat/invites/<int:invite_id>/<str:action>/', handle_invite_view, name='respond_to_invite'),

]