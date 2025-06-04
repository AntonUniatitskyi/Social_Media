FROM python:3.12-slim

WORKDIR /social_media
COPY . /social_media/

RUN pip install --no-cache-dir -r requirements.txt
RUN python manage.py collectstatic
RUN python manage.py migrate

CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "core.asgi:application"]