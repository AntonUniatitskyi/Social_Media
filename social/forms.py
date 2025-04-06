from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth.models import User, Group
from django.forms import Form, EmailField, EmailInput, CharField, PasswordInput, TextInput, ChoiceField, ModelChoiceField, Select


class UserForm(UserCreationForm):
    password1 = CharField(
        # label="Пароль",
        widget=PasswordInput(attrs={
            # 'class': 'form-control email',
            # 'placeholder': 'Придумайте пароль',
            'id': 'id_password1',
            'data-toggle': 'password',
        })
    )
    password2 = CharField(
        # label="Повторіть пароль",
        widget=PasswordInput(attrs={
            # 'class': 'form-control email',
            # 'placeholder': 'Повторіть пароль',
            'id': 'id_password2',
            'data-toggle': 'password',
        })
    )

    class Meta:
        model = User
        fields = ["username", "email", "password1", "password2"]
        widgets = {
            "username": TextInput(attrs={
                # 'class': 'form-control email',
                # 'placeholder': 'Імя користувача',
            }),
            "email": EmailInput(attrs={
                # 'class': 'form-control email',
                # 'placeholder': 'Ваша пошта',
            }),
        }


class UserPasswordForm(AuthenticationForm):
    # Переопределяем поле username как email
    username = CharField(
        # label="Юзернейм",
        widget=TextInput(attrs={
            # 'class': 'form-control email',
            # 'placeholder': 'Ваш юзернейм',
        })
    )
    password = CharField(
        # label="Пароль",
        widget=PasswordInput(attrs={
            # 'class': 'form-control email',
            # 'placeholder': 'Пароль',
            'id': 'id_password',
            'data-target': 'id_password',
        })
    )

    class Meta:
        fields = ['username', 'password']