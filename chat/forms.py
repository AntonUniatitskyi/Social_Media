from .models import *
from django.forms import ModelForm
from django import forms

class ChatMessageCreateForm(ModelForm):
    class Meta:
        model = GroupMessage
        fields = ['body']
        widgets = {
            'body': forms.TextInput(attrs={
                'placeholder': 'Введіть повідомлення...',
                'class': (
                    'w-full p-1 rounded-2xl bg-white text-black '
                    'focus:outline-none focus:ring-2 focus:ring-emerald-400 '
                    'transition duration-200 shadow-inner'
                ),
                'maxlength': '400',
                'autofocus': True
                })
        }

class NewGroupForm(ModelForm):
    class Meta:
        model = ChatGroup
        fields = ['group_chat_name']
        widgets = {
            'group_chat_name': forms.TextInput(attrs={
                'placeholder': 'Назва чату...',
                'class': 'w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 shadow-sm transition duration-200',
                'maxlength': '300',
                'autofocus': True
            })
        }

class ChatRoomEditForm(ModelForm):
    class Meta:
        model = ChatGroup
        fields = ['group_chat_name']
        widgets = {
            'group_chat_name': forms.TextInput(attrs={
                'class': 'w-full p-4 text-xl font-bold mb-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-200',
                'maxlength': '300'
            })
        }

class InviteUserForm(forms.Form):
    def __init__(self, *args, chat_group=None, **kwargs):
        super().__init__(*args, **kwargs)
        if chat_group:
            self.fields['user'].queryset = User.objects.filter(
                is_active=True
            ).exclude(
                id__in=chat_group.members.values_list('id', flat=True)
            ).exclude(
                id=chat_group.admin_id
            )
    user = forms.ModelChoiceField(
        queryset=User.objects.none(),
        label="Оберіть користувача",
        widget=forms.Select(attrs={
            "class": "mt-1 block w-full h-10 rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm",
        })
    )