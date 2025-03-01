import logging
import re

from django.conf.urls import include, url
from django.urls import URLPattern, URLResolver

from sentry.plugins.base import plugins

logger = logging.getLogger("sentry.plugins")


def load_plugin_urls(plugins):
    urlpatterns = []
    for plugin in plugins:
        urls = plugin.get_project_urls()
        if not urls:
            continue
        try:
            # a plugin's get_project_urls should return an iterable of url()'s,
            # which can either be URLResolver or URLPattern
            for u in urls:
                if not isinstance(u, (URLResolver, URLPattern)):
                    raise TypeError(
                        "url must be URLResolver or URLPattern, not {!r}: {!r}".format(
                            type(u).__name__, u
                        )
                    )
        except Exception:
            logger.exception("routes.failed", extra={"plugin": type(plugin).__name__})
        else:
            urlpatterns.append(url(r"^%s/" % re.escape(plugin.slug), include(urls)))

    return urlpatterns


urlpatterns = load_plugin_urls(plugins.all())
