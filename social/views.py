from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.views.decorators.csrf import csrf_exempt
from django.db import IntegrityError
from .forms import UserForm, ProfileForm, UserPasswordForm, UserEditForm, PublicationForm, CommentForm
import core.settings
from django.http import HttpResponseRedirect
from django.contrib.auth.models import User, Group
from django.views.generic import DetailView, ListView, View, CreateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Q
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.contrib.auth import login
from . import models
from django.http import JsonResponse
import json

# Create your views here.



def home(request):
    return render(request, 'social/home.html')

class CommentCreateView(LoginRequiredMixin, CreateView):
    model = models.Comment
    form_class = CommentForm
    template_name = 'social/profile_about.html'
    context_object_name = 'form'

    def form_valid(self, form):
        publication_id = self.request.POST.get('publication_id')
        publication = get_object_or_404(models.Publication, pk=publication_id)
        comment = form.save(commit=False)
        comment.user = self.request.user.profile
        comment.publication = publication
        comment.save()

        return JsonResponse({
            'success': True,
            'username': comment.user.user.username,
            'text': comment.text_com,
            'timestamp': comment.created_at.strftime('%d.%m.%Y %H:%M'),
            'publication_id': publication.id
        })

    #     return HttpResponseRedirect(self.get_success_url())
    # def get_success_url(self):
    #     return self.request.META.get('HTTP_REFERER', '/')
    def form_invalid(self, form):
        return JsonResponse({'success': False, 'errors': form.errors}, status=400)

class PublicationCreateView(LoginRequiredMixin, CreateView):
    model = models.Publication
    form_class = PublicationForm
    template_name = 'social/create_publicate.html'

    def form_valid(self, form):
        publication = form.save(commit=False)
        publication.profile = self.request.user.profile
        publication.save()

        files = self.request.FILES.getlist('media')
        if len(files) > 10:
            form.add_error(None, 'Максимум 10 файлов')
            return self.form_invalid(form)

        for file in files[:10]:
            models.MediaItem.objects.create(publication=publication, file=file)

        return redirect('home')

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
            return redirect('home')
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
        publications = user.profile.publications.all()
        for pub in publications:
            pub.liked_by_user = pub.is_liked_by(self.request.user)
        context['followers'] = user.profile.followers.all()
        context['following'] = User.objects.filter(profile__followers=user)
        context['form'] = CommentForm()
        context['publications'] = publications
        return context

class HomeView(LoginRequiredMixin, ListView):
    model = models.Publication
    template_name = 'social/home.html'
    context_object_name = 'home'

    def get_queryset(self):
        user = self.request.user
        
        following_profiles = models.Profile.objects.filter(followers=user)
        followed_publications = models.Publication.objects.filter(profile__in=following_profiles)
        other_publications = models.Publication.objects.exclude(profile__in=following_profiles)
        publications = list(followed_publications.order_by('-timestamp')) + list(other_publications.order_by('-timestamp'))

        return publications

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.request.user
        if user.is_authenticated:
            for pub in context['home']:
                pub.liked_by_user = pub.is_liked_by(user)
        context['form'] = CommentForm()
        return context

@require_POST
@login_required
def like_publ(request, publication_id):
    target_publication = models.Publication.objects.get(pk=publication_id)
    user = request.user
    liked = False
    if user in target_publication.likes.all():
        target_publication.likes.remove(user)
    else:
        target_publication.likes.add(user)
        liked = True
    return JsonResponse({
        'success': True,
        'liked': liked,
        'likes_count': target_publication.likes_count()
    })


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
        publications = user.profile.publications.all()
        for pub in publications:
            pub.liked_by_user = pub.is_liked_by(self.request.user)
        context['publications'] = publications
        context['form'] = CommentForm()
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

def post_data(request, post_id):
    publication = get_object_or_404(models.Publication, id=post_id)
    first_media = publication.media_items.first()
    comments = publication.comments.all()

    return JsonResponse({
        "username": publication.profile.user.username,
        "timestamp": publication.timestamp.strftime("%d.%m.%Y %H:%M"),
        "media_url": first_media.file.url if first_media else '',
        "is_image": first_media.is_image() if first_media else False,
        "is_video": first_media.is_video() if first_media else False,
        "comments": [
            {"user": c.user.username, "text": c.text}
            for c in comments
        ]
    })

def setting_page(request):
    return render(request, 'social/settings_page.html')