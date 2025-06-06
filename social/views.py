from random import shuffle
from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import Group, User
from django.db import IntegrityError
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render, HttpResponseRedirect
from django.views.decorators.http import require_POST
from django.views.generic import CreateView, DetailView, ListView, View
from PIL import Image
from io import BytesIO
from django.core.files.base import ContentFile
import core.settings
from chat.models import ChatInvitation
from . import models
from .forms import CommentForm, ProfileForm, PublicationForm, UserEditForm, UserForm, SetAdminForm, SetComplainForm

# Create your views here.
@login_required
def delete_publication(request, pk):
    publication = get_object_or_404(models.Publication, pk=pk)
    if request.user == publication.profile.user:
        publication.delete()
        messages.success(request, "Публікацію видалено!")
        return redirect('account')
    else:
        messages.error(request, "Ви не можете видалити цю публікацію.")
        return redirect('account')

def redirect_to_profile_publication(request, pk):
    publication = get_object_or_404(models.Publication, pk=pk)
    profile_username = publication.profile.user.username
    profile_url = f"/profile/{profile_username}/#publication-{pk}"
    return HttpResponseRedirect(profile_url)

@login_required
def get_save_publication(request):
    if request.method == 'POST':
        publ_id = request.POST.get('publication_id')
        publication = get_object_or_404(models.Publication, id=publ_id)

        if request.user in publication.saved.all():
            publication.saved.remove(request.user)
            saved = False
        else:
            publication.saved.add(request.user)
            saved = True
        return JsonResponse({'saved': saved})


def notification(request):
    user = request.user
    invites = ChatInvitation.objects.filter(to_user=user, accepted=None)
    notifications = request.user.notifications.order_by('-created_at')
    notifications.filter(is_read=False).update(is_read=True)
    complaint = models.Complaint.objects.filter(accepted=None).order_by('-created_at')
    return render(request, 'social/notification.html', {'invites': invites, 'notifications': notifications, 'complaint': complaint})

def respond_to_complaint(request, complaint_id, action):
    complaint = get_object_or_404(models.Complaint, id=complaint_id)

    if action == 'accept':
        complaint.accept_complaint()
    elif action == 'reject':
        complaint.reject_complaint()
    return redirect(request.META.get('HTTP_REFERER', '/'))

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

        target_user = publication.profile.user

        models.Notification.objects.create(
            recipient=target_user,
            sender=self.request.user,
            message=f"{self.request.user.username} залишив коментар до вашої публікації"
        )

        return JsonResponse({
            'success': True,
            'username': comment.user.user.username,
            'text': comment.text_com,
            'timestamp': comment.created_at.strftime('%d.%m.%Y %H:%M'),
            'publication_id': publication.id
        })
    def form_invalid(self, form):
        return JsonResponse({'success': False, 'errors': form.errors}, status=400)

def crop_to_aspect_ratio(image, target_ratio=(4, 3)):
    if image.mode in ('RGBA', 'LA'):
        image = image.convert('RGB')
    img_width, img_height = image.size
    target_w, target_h = target_ratio
    target_ratio_float = target_w / target_h
    current_ratio = img_width / img_height

    if current_ratio > target_ratio_float:
        # ширина надлишкова — обрізати по ширині
        new_width = int(img_height * target_ratio_float)
        offset = (img_width - new_width) // 2
        box = (offset, 0, offset + new_width, img_height)
    else:
        # висота надлишкова — обрізати по висоті
        new_height = int(img_width / target_ratio_float)
        offset = (img_height - new_height) // 2
        box = (0, offset, img_width, offset + new_height)

    return image.crop(box)

class PublicationCreateView(LoginRequiredMixin, CreateView):
    model = models.Publication
    form_class = PublicationForm
    template_name = 'social/create_publicate.html'

    def form_valid(self, form):
        files = self.request.FILES.getlist('media')

        if not files:
            form.add_error(None, 'Потрібно додати хоча б один файл медіа.')
            return self.form_invalid(form)

        if len(files) > 10:
            form.add_error(None, 'Максимум 10 файлів.')
            return self.form_invalid(form)

        publication = form.save(commit=False)
        publication.profile = self.request.user.profile
        publication.save()

        for file in files[:10]:
            if file.content_type.startswith('image/'):
                try:
                    img = Image.open(file)
                    img = crop_to_aspect_ratio(img)
                    buffer = BytesIO()
                    img_format = img.format if img.format else 'JPEG'
                    img.save(buffer, format=img_format)
                    buffer.seek(0)
                except Exception as e:
                    form.add_error(None, f"Не вдалося обробити файл {file.name}: {e}")
                    return self.form_invalid(form)
                finally:
                    img.close()
                django_file = ContentFile(buffer.read(), name=file.name)
                models.MediaItem.objects.create(publication=publication, file=django_file)
            else:
                models.MediaItem.objects.create(publication=publication, file=file)

        for follower in publication.profile.followers.all():
            models.Notification.objects.create(
                recipient=follower,
                sender=self.request.user,
                message=f"{self.request.user.username} створив нову публікацію"
            )

        messages.success(self.request, "Публікацію створено!")
        return redirect('home')
    def form_invalid(self, form):
        return self.render_to_response(self.get_context_data(form=form))

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
            pub.saved_by_user = pub.is_saved_by(self.request.user)
        context['followers'] = user.profile.followers.all()
        context['following'] = User.objects.filter(profile__followers=user)
        context['form'] = CommentForm()
        context['complaint'] = SetComplainForm()
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
        invites = ChatInvitation.objects.filter(to_user=self.request.user, accepted=None)
        if user.is_authenticated:
            for pub in context['home']:
                pub.liked_by_user = pub.is_liked_by(user)
                pub.saved_by_user = pub.is_saved_by(self.request.user)
        context['form'] = CommentForm()
        context['complaint'] = SetComplainForm()
        context['followers'] = user.profile.followers.all()
        context['following'] = User.objects.filter(profile__followers=user)
        context['recomended'] = User.objects.exclude(profile__followers=user).exclude(id=user.id)
        recommended_list = list(context['recomended'])
        shuffle(recommended_list)
        context['recomended'] = recommended_list
        context['invites'] = invites

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


@require_POST
@login_required
def add_complaint(request, publication_id):
    target_publication = get_object_or_404(models.Publication, pk=publication_id)
    user = request.user

    form = SetComplainForm(request.POST)
    if form.is_valid():
        complaint = form.save(commit=False)
        complaint.user = user
        complaint.publication = target_publication
        complaint.save()
        messages.success(request, "Ваша скарга успішно відправлена!")
    return redirect(request.META.get('HTTP_REFERER', '/'))


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

        models.Notification.objects.create(
            recipient=target_user,
            sender=request.user,
            message=f"{request.user.username} підписався(лась) на вас"
        )

    return redirect('profile', username=target_user.username)

class SavedPublicationView(LoginRequiredMixin, ListView):
    model = models.Publication
    template_name = 'social/saved_publ.html'
    context_object_name = 'publications'

    def get_queryset(self):
        queryset = self.request.user.saved_publications.all() \
            .select_related('profile') \
            .prefetch_related('media_items')

        for publication in queryset:
            publication.is_liked_by_user = publication.is_liked_by(self.request.user)

        return queryset

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
            pub.saved_by_user = pub.is_saved_by(self.request.user)
        context['publications'] = publications
        context['form'] = CommentForm()
        context['followers'] = user.profile.followers.all()
        context['following'] = User.objects.filter(profile__followers=user)
        context['complaint'] = SetComplainForm()
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
    set_admin_form = SetAdminForm()
    message = None

    if request.method == 'POST':
        set_admin_form = SetAdminForm(request.POST, user=request.user)

        if set_admin_form.is_valid():
            userr = set_admin_form.cleaned_data['user']
            admin_group = Group.objects.get(name='Адміністратор')
            user_group = Group.objects.get(name='Користувач')

            if admin_group in userr.groups.all():
                userr.groups.remove(admin_group)
                userr.groups.add(user_group)
                message = f'{userr.username} переведено в групу "Користувач".'
            else:
                userr.groups.clear()
                userr.groups.add(admin_group)
                message = f'{userr.username} додано до групи "Адміністратор".'
            set_admin_form = SetAdminForm(user=request.user)
        else:
            set_admin_form = SetAdminForm(user=request.user)

    return render(request, 'social/settings_page.html', {'set_admin_form': set_admin_form, 'message': message})


def base_context(request):
    unread_count = 0
    if request.user.is_authenticated:
        unread_count = request.user.notifications.filter(is_read=False).count()
    return {'unread_notifications': unread_count}