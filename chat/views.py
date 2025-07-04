from django.contrib.auth.decorators import login_required
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.http import Http404
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.http import HttpResponse
from .models import *
from .forms import *

@login_required
def chat_list(request):
    user = request.user
    return render(request, 'chat/chat_list.html', {'user': user})

@login_required
def chat_view(request, chatroom_name='public-chat'):
    chat_group = get_object_or_404(ChatGroup, group_name=chatroom_name)
    chat_messages = chat_group.chat_messages.all()[:30]
    form = ChatMessageCreateForm()

    other_user = None
    if chat_group.is_private:
        if request.user not in chat_group.members.all():
            raise Http404
        for member in chat_group.members.all():
            if member != request.user:
                other_user = member
                break

    if chat_group.group_chat_name:
        if request.user not in chat_group.members.all():
            chat_group.members.add(request.user)

    if request.htmx:
        form = ChatMessageCreateForm(request.POST)
        if form.is_valid():
            message = form.save(commit=False)
            message.author = request.user
            message.group = chat_group
            message.save()
            context = {
                'message': message,
                'user': request.user,

            }
            return render(request, 'chat/partials/chat_message.html', context)

    context = {
        'chat_messages': chat_messages,
        'form': form,
        'other_user': other_user,
        'chatroom_name': chatroom_name,
        'chat_group': chat_group,
        'hide_footer': True,
        'hide_header': True
    }

    return render(request, 'chat/chat.html', context)

@login_required
def get_or_create_chatroom(request, username):
    if request.user.username == username:
        return redirect('chat_home')

    other_user = User.objects.get(username=username)
    my_chatrooms = request.user.chat_groups.filter(is_private=True)

    existing_chat = None

    for chatroom in my_chatrooms:
        if other_user in chatroom.members.all():
            existing_chat = chatroom
            break

    if existing_chat:
        chatroom = existing_chat
    else:
        chatroom = ChatGroup.objects.create(is_private=True)
        chatroom.members.add(request.user, other_user)

    return redirect('chatroom', chatroom.group_name)


@login_required
def create_groupchat(request):
    if request.method == 'POST':
        form = NewGroupForm(request.POST)
        if form.is_valid():
            new_groupchat = form.save(commit=False)
            new_groupchat.admin = request.user
            new_groupchat.save()
            new_groupchat.members.add(request.user)
            return redirect('chatroom', new_groupchat.group_name)

    form = NewGroupForm()
    context = {
        'form': form
    }
    return render(request, 'chat/create_groupchat.html', context)


@login_required
def chatroom_edit_view(request, chatroom_name):
    chat_group = get_object_or_404(ChatGroup, group_name=chatroom_name)
    if request.user != chat_group.admin:
        raise Http404()

    form = ChatRoomEditForm(instance=chat_group)
    invite_form = InviteUserForm(chat_group=chat_group)

    if request.method == 'POST':
        if 'update_group' in request.POST:
            form = ChatRoomEditForm(request.POST, instance=chat_group)
            if form.is_valid():
                form.save()

                remove_members = request.POST.getlist('remove_members')
                for member_id in remove_members:
                    member = User.objects.get(id=member_id)
                    chat_group.members.remove(member)

                messages.success(request, "Налаштування збережено.")
                return redirect('chatroom', chatroom_name)

        elif 'invite_user' in request.POST:
            invite_form = InviteUserForm(request.POST, chat_group=chat_group)
            if invite_form.is_valid():
                to_user = invite_form.cleaned_data['user']
                if to_user not in chat_group.members.all():
                    ChatInvitation.objects.get_or_create(
                        from_user=request.user,
                        to_user=to_user,
                        chat_group=chat_group
                    )
                    messages.success(request, f"{to_user.username} запрошено до чату.")
                return redirect('chatroom', chatroom_name)

    context = {
        'form': form,
        'invite_form': invite_form,
        'chat_group': chat_group
    }
    return render(request, 'chat/chatroom_edit.html', context)



@login_required
def chatroom_delete_view(request, chatroom_name):
    chat_group = get_object_or_404(ChatGroup, group_name=chatroom_name)
    if request.user != chat_group.admin:
        raise Http404()

    if request.method == 'POST':
        chat_group.delete()
        messages.success(request, 'Чат видалено!')
        return redirect('chat_list')
    return render(request, 'chat/chatroom_delete.html', {'chat_group': chat_group})


@login_required
def chatroom_leave_view(request, chatroom_name):
    chat_group = get_object_or_404(ChatGroup, group_name=chatroom_name)
    if request.user not in chat_group.members.all():
        raise Http404()

    if request.method == 'POST':
        chat_group.members.remove(request.user)
        messages.success(request, "Ти покинув чат")
        return redirect('chat_list')


@login_required
def favorites_chat_view(request):
    # Ищем, есть ли уже чат с самим собой
    favorites_group_name = f"favorites_{request.user.username}"
    chat_group, created = ChatGroup.objects.get_or_create(
        group_name=favorites_group_name,
        defaults={
            'is_private': True,
            'group_chat_name': f"Вибране ({request.user.username})"
        }
    )

    if created:
        chat_group.members.add(request.user)

    return redirect('chatroom', chat_group.group_name)


@login_required
def handle_invite_view(request, invite_id, action):
    invite = get_object_or_404(ChatInvitation, id=invite_id, to_user=request.user, accepted__isnull=True)
    referer = request.META.get('HTTP_REFERER', '/')

    if action == 'accept':
        invite.accepted = True
        invite.chat_group.members.add(request.user)
    elif action == 'decline':
        invite.accepted = False

    invite.save()
    invite.delete()

    return redirect(referer)


def chat_file_upload(request, chatroom_name):
    chat_group = get_object_or_404(ChatGroup, group_name=chatroom_name)

    if request.htmx and request.FILES:
        file = request.FILES['file']
        message = GroupMessage.objects.create(
            file = file,
            author = request.user,
            group = chat_group
        )
        channel_layer = get_channel_layer()
        event = {
            'type': 'message_handler',
            'message_id': message.id
        }
        async_to_sync(channel_layer.group_send)(
            chatroom_name, event
        )
    return HttpResponse()