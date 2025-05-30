import re
from django import template

register = template.Library()

@register.filter
def is_url(value):
    url_regex = re.compile(
        r'^(https?|ftp)://[^\s/$.?#].[^\s]*$', re.IGNORECASE
    )
    return bool(url_regex.match(value or ''))