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