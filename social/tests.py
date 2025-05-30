from django.contrib.auth.models import User
from django.test import TestCase, RequestFactory
from .views import HomeView

# Create your tests here.

class HomeViewTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='12345')

    def test_home_view(self):
        self.client.login(username='testuser', password='12345')
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)

    def test_home_ajax(self):
        factory = RequestFactory()
        request = factory.get('/', HTTP_X_REQUESTED_WITH = 'XMLHttpRequest')
        request.user = self.user
        response = HomeView.as_view()(request)
        self.assertEqual(response.status_code, 200)