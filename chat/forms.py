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
                    'w-full p-3 rounded-2xl bg-white text-black '
                    'focus:outline-none focus:ring-2 focus:ring-emerald-400 '
                    'transition duration-200 shadow-inner'
                ),
                'maxlength': '400',
                'autofocus': True
                })
        }