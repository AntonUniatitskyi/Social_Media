from django.urls import path
from . import views
from django.contrib.auth import views as auth_views
from . import forms
urlpatterns = [
    path('', views.HomeView.as_view(), name='home'),
    path('login/', auth_views.LoginView.as_view(template_name='social/login.html', authentication_form=forms.UserPasswordForm), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('register/', views.add_user, name='register'),
    path('account/', views.AccountAboutView.as_view(), name='account'),
    path('search/', views.SearchListView.as_view(), name='search'),
    path('profile/<str:username>/', views.ProfileDetailView.as_view(), name='profile'),
    path('profile/<str:username>/follow/', views.follow, name='follow'),
    path('edit/', views.ProfileUpdateView.as_view(), name='edit'),
    path('add-publication/', views.PublicationCreateView.as_view(), name='publ_add'),
    path('post-data/<int:post_id>/', views.post_data, name='post_data'),
    path('create_comment/', views.CommentCreateView.as_view(), name='create_comment'),
    path('like/<int:publication_id>/', views.like_publ, name='like_publ'),
    path('setting-page/', views.setting_page, name='settings'),
    path('notification/', views.notification ,name='notification'),
    path('add-complaint/<int:publication_id>/', views.add_complaint, name='add_complaint'),
    path('respond_to_complaint/<int:complaint_id>/<str:action>/', views.respond_to_complaint, name='respond_complaint')
]