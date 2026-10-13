"""
Serve Seventeen Training Kit content with Django's own authentication.

- The manifest is filtered on the server with the user's real groups: the browser never
  decides what it may see.
- Every media/tour file is authorized individually: it must be referenced by a tutorial or
  tour the current user is allowed to see. Guessing a URL returns 404.
- Files support HTTP Range so the native <video> player can seek (chapters, transcript).
"""

import json
import mimetypes
import re
from pathlib import Path

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import FileResponse, Http404, HttpResponse, JsonResponse, StreamingHttpResponse
from django.urls import reverse
from django.views.decorators.http import require_GET

mimetypes.add_type("text/vtt", ".vtt")
CHUNK = 256 * 1024


def _roles(user) -> set[str]:
    roles = set(user.groups.values_list("name", flat=True))
    if user.is_superuser:
        roles.add("admin")
    return roles


def _visible(item: dict, roles: set[str]) -> bool:
    return item.get("status") == "published" and (not item.get("roles") or bool(roles & set(item["roles"])))


def _filtered_manifest(user) -> dict:
    root = Path(settings.TRAINING_ROOT)
    data = json.loads((root / "manifest.json").read_text("utf-8"))
    if data.get("status") != "published":
        data["tutorials"], data["tours"] = [], []
    roles = _roles(user)
    data["tutorials"] = [t for t in data.get("tutorials", []) if _visible(t, roles)]
    data["tours"] = [t for t in data.get("tours", []) if _visible(t, roles)]
    return data


def _allowed_paths(manifest: dict) -> set[str]:
    paths = {t["src"] for t in manifest["tours"]}
    for t in manifest["tutorials"]:
        v = t["video"]
        paths.add(v["src"])
        paths.update(p for p in [v.get("poster")] if p)
        paths.update(c["src"] for c in v.get("captions", []))
    return paths


@login_required
@require_GET
def manifest(request):
    data = _filtered_manifest(request.user)
    # Relative asset paths resolve against the protected file view.
    data["assetsBase"] = reverse("training-file", args=["x"])[:-1]
    response = JsonResponse(data, json_dumps_params={"ensure_ascii": False})
    response["Cache-Control"] = "private, no-store"
    return response


@login_required
@require_GET
def training_file(request, path: str):
    if path not in _allowed_paths(_filtered_manifest(request.user)):
        raise Http404()
    root = Path(settings.TRAINING_ROOT).resolve()
    full = (root / path).resolve()
    if not full.is_relative_to(root) or not full.is_file():
        raise Http404()

    if settings.TRAINING_X_ACCEL_PREFIX:  # production: nginx streams the file (Range included)
        response = HttpResponse(content_type=mimetypes.guess_type(full.name)[0] or "application/octet-stream")
        response["X-Accel-Redirect"] = settings.TRAINING_X_ACCEL_PREFIX + path
    else:
        response = _ranged_response(request, full)
    response["Cache-Control"] = "private, max-age=300"
    response["X-Content-Type-Options"] = "nosniff"
    return response


def _ranged_response(request, full: Path):
    size = full.stat().st_size
    ctype = mimetypes.guess_type(full.name)[0] or "application/octet-stream"
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", request.headers.get("Range", "").strip())
    if not match or match.groups() == ("", ""):
        response = FileResponse(full.open("rb"), content_type=ctype)
        response["Accept-Ranges"] = "bytes"
        return response

    first, last = match.groups()
    if first == "":  # suffix range: last N bytes
        start, end = max(0, size - int(last)), size - 1
    else:
        start, end = int(first), min(int(last) if last else size - 1, size - 1)
    if start > end or start >= size:
        return HttpResponse(status=416, headers={"Content-Range": f"bytes */{size}"})

    def stream():
        with full.open("rb") as f:
            f.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                chunk = f.read(min(CHUNK, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    response = StreamingHttpResponse(stream(), status=206, content_type=ctype)
    response["Content-Range"] = f"bytes {start}-{end}/{size}"
    response["Content-Length"] = str(end - start + 1)
    response["Accept-Ranges"] = "bytes"
    return response
