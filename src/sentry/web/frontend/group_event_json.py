from django.http import Http404, HttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore
from sentry.models import Group, GroupMeta, get_group_with_redirect
from sentry.utils import json
from sentry.web.frontend.base import OrganizationView


class GroupEventJsonView(OrganizationView):
    required_scope = "event:read"

    def get(self, request: Request, organization, group_id, event_id_or_latest) -> Response:
        try:
            # TODO(tkaemming): This should *actually* redirect, see similar
            # comment in ``GroupEndpoint.convert_args``.
            group, _ = get_group_with_redirect(group_id)
        except Group.DoesNotExist:
            raise Http404

        if event_id_or_latest == "latest":
            event = group.get_latest_event()
        else:
            event = eventstore.backend.get_event_by_id(
                group.project.id, event_id_or_latest, group_id=group.id
            )

        if event is None:
            raise Http404

        GroupMeta.objects.populate_cache([group])

        return HttpResponse(json.dumps(event.as_dict()), content_type="application/json")
