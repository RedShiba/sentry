import abc

from django.db import transaction
from django.http import Http404, HttpResponseRedirect
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.models import OrganizationMember
from sentry.web.decorators import signed_auth_required
from sentry.web.frontend.base import BaseView

signed_auth_required_m = method_decorator(signed_auth_required)


class UnsubscribeBaseView(BaseView, metaclass=abc.ABCMeta):
    auth_required = False

    @never_cache
    @signed_auth_required_m
    def handle(self, request: Request, **kwargs) -> Response:
        with transaction.atomic():
            if not getattr(request, "user_from_signed_request", False):
                raise Http404

            instance = self.fetch_instance(**kwargs)

            if not OrganizationMember.objects.filter(
                user_id=request.user.id, organization=instance.organization
            ).exists():
                raise Http404

            instance_link = self.build_link(instance)

            if request.method == "POST":
                if request.POST.get("op") == "unsubscribe":
                    self.unsubscribe(instance, request.user)
                return HttpResponseRedirect(instance_link)

        return self.respond(
            "sentry/unsubscribe-notifications.html",
            {"instance_link": instance_link, "object_type": self.object_type},
        )

    @abc.abstractproperty
    def object_type(self):
        pass

    @abc.abstractproperty
    def fetch_instance(self, **kwargs):
        pass

    @abc.abstractmethod
    def build_link(self, instance):
        pass

    @abc.abstractmethod
    def unsubscribe(self, instance, user):
        pass
