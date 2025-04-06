from django.shortcuts import render, redirect
from django.contrib import messages
from django.db import IntegrityError
from .forms import UserForm
import core.settings
from django.contrib.auth.models import User, Group
from django.views.generic import UpdateView, DetailView
from django.contrib.auth.mixins import LoginRequiredMixin


# Create your views here.

def home(request):
    return render(request, 'social/home.html')

class AccountAboutView(LoginRequiredMixin, DetailView):
    model = User
    template_name = 'social/account.html'
    context_object_name = 'account_detail'

    def get_object(self):
        return self.request.user

def add_user(request):
    if request.method == 'POST':
        form = UserForm(request.POST)
        if form.is_valid():
            try:
                user = form.save()
                request.session['username'] = user.username
                
                if user.email in core.settings.ADMIN_EMAIL:
                    group = Group.objects.get(name="Адміністратор")
                    user.groups.add(group)
                else:
                    group = Group.objects.get(name="Користувач")
                    user.groups.add(group)

                return redirect('home')
            except IntegrityError:
                messages.error(request, 'Користувач з такою поштою вже зареєстрований.')
        else:
            print(form.errors)
            messages.error(request, 'Виникла помилка. Перевірте введені дані.')
    else:
        form = UserForm()
    
    return render(request, 'social/register.html', {'form': form})