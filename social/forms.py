from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth.models import User, Group
from django.forms import Form, EmailField, EmailInput, CharField, PasswordInput, TextInput, Textarea, ChoiceField, ModelChoiceField, Select
from .models import Profile, Publication, Comment
from django import forms

class CommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ['text_com']
        widgets = {
            'text_com': forms.Textarea(attrs={
                'id': 'commentInput',
                'rows': 2,
                'placeholder': 'Ваш коментар',
                # 'style': 'background-color: white; border-color: black; width: auto',
                'class': 'comment-text',
                # 'style': 'color: #4a4a4a; background-color: #b7ada5'
            })
        }

class PublicationForm(forms.ModelForm):
    class Meta:
        model = Publication
        fields = ['text']
        widgets = {
            'text': forms.Textarea(attrs={
                'id': 'id_text',
                'rows': 2,
                'placeholder': 'Підпис',
                'class': 'w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm'
            }),
        }
    def __init__(self, *args, **kwargs):
        self.files = kwargs.pop('files', None)
        super().__init__(*args, **kwargs)

class ProfileForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ['bio', 'avatar', 'uusername']
        widgets = {
            'uusername': forms.TextInput(attrs={
                'id': 'uusername',
                'placeholder': 'Ваш нік'
            }),
            'bio': forms.Textarea(attrs={
                'id': 'id_bio',
                'rows': 4,
                'placeholder': 'Розкажіть про себе...'
            }),
            'avatar': forms.ClearableFileInput()
        }

class UserForm(UserCreationForm):
    password1 = CharField(
        widget=PasswordInput(attrs={
            'id': 'id_password1',
            'data-toggle': 'password',
        })
    )
    password2 = CharField(
        widget=PasswordInput(attrs={
            'id': 'id_password2',
            'data-toggle': 'password',
        })
    )

    class Meta:
        model = User
        fields = ["username", "email", "password1", "password2"]
        widgets = {
            "username": TextInput(attrs={
            }),
            "email": EmailInput(attrs={
            }),
        }


class UserEditForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ['email', 'username']
        widgets = {
            'email': EmailInput(),
            'username': TextInput()
        }


class UserPasswordForm(AuthenticationForm):
    username = CharField(
        widget=TextInput(attrs={
        })
    )
    password = CharField(
        widget=PasswordInput(attrs={
            'id': 'id_password',
            'data-target': 'id_password',
        })
    )

    class Meta:
        fields = ['username', 'password']