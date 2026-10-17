import functools
import time

import redis
from django.conf import settings

TTL = 75
_r = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True) if settings.REDIS_URL else None


def _safe(default):
    def deco(fn):
        @functools.wraps(fn)
        def inner(*a, **kw):
            if _r is None:
                return default
            try:
                return fn(*a, **kw)
            except redis.RedisError:
                return default
        return inner
    return deco


def _key(uid):
    return f"presence:u:{uid}"


def _alive(uid):
    return _r.zcount(_key(uid), time.time() - TTL, "+inf") > 0


@_safe(False)
def add(uid, channel):
    was = _alive(uid)
    touch(uid, channel)
    return not was


@_safe(None)
def touch(uid, channel):
    p = _r.pipeline()
    p.zadd(_key(uid), {channel: time.time()})
    p.expire(_key(uid), TTL * 4)
    p.execute()


@_safe(False)
def remove(uid, channel):
    _r.zrem(_key(uid), channel)
    return not _alive(uid)


@_safe(set())
def online_among(ids):
    ids = list(ids)
    if not ids:
        return set()
    cutoff = time.time() - TTL
    p = _r.pipeline()
    for i in ids:
        p.zcount(_key(i), cutoff, "+inf")
    return {i for i, c in zip(ids, p.execute()) if c > 0}