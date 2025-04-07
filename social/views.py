from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db import IntegrityError
from .forms import UserForm, ProfileForm, UserPasswordForm, UserEditForm
import core.settings
from django.contrib.auth.models import User, Group
from django.views.generic import DetailView, ListView, View
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Q
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login

# Create your views here.

def home(request):
    return render(request, 'social/home.html')

class ProfileUpdateView(LoginRequiredMixin, View):
    def get(self, request):
        user_form = UserEditForm(instance=request.user)
        profile_form = ProfileForm(instance=request.user.profile)
        return render(request, 'social/edit_profile.html', {
            'user_form': user_form,
            'profile_form': profile_form
        })
    
    def post(self, request):
        user_form = UserEditForm(request.POST, instance=request.user)
        profile_form = ProfileForm(request.POST, request.FILES, instance=request.user.profile)

        if user_form.is_valid() and profile_form.is_valid():
            user_form.save()
            profile_form.save()
            login(request, request.user)
            return redirect('profile')
        return render(request, 'social/edit_profile.html', {
            'user_form': user_form,
            'profile_form': profile_form
        })


class SearchListView(LoginRequiredMixin, ListView):
    model = User
    template_name = 'social/search.html'
    context_object_name = 'accounts_list'

    def get_queryset(self):
        query = self.request.GET.get('q')
        if query:
            return User.objects.filter(Q(username__icontains=query) | Q(email__icontains=query))
        return User.objects.all()
    
class ProfileDetailView(DetailView):
    model = User
    template_name = 'social/profile_about.html'
    context_object_name = 'profile'
    slug_field = 'username'
    slug_url_kwarg = 'username'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.get_object()
        context['followers'] = user.profile.followers.all()
        context['following'] = User.objects.filter(profile__followers=user)
        return context

@login_required
def follow(request, username):
    target_user = get_object_or_404(User, username=username)
    if request.user == target_user:
        return redirect('profile', username=username)
    profile = target_user.profile
    if request.user in profile.followers.all():
        profile.followers.remove(request.user)  # Відписка
    else:
        profile.followers.add(request.user)  # Підписка

    return redirect('profile', username=target_user.username)

class AccountAboutView(LoginRequiredMixin, DetailView):
    model = User
    template_name = 'social/account.html'
    context_object_name = 'account_detail'

    def get_object(self):
        return self.request.user
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.request.user
        context['followers'] = user.profile.followers.all()
        context['following'] = User.objects.filter(profile__followers=user)
        return context

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