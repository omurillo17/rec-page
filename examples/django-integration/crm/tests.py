from django.contrib.auth.models import Group, User
from django.test import TestCase
from django.urls import reverse


class TrainingAccessTests(TestCase):
    """The host app (Django) decides what the kit may show; the kit only displays it."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user("operador", password="pw-de-prueba")
        cls.supervisor = User.objects.create_user("supervisora", password="pw-de-prueba")
        cls.supervisor.groups.add(Group.objects.create(name="supervisores"))

    def manifest(self):
        return self.client.get(reverse("training-manifest")).json()

    def test_anonymous_users_are_redirected_to_login(self):
        for url in [reverse("training-manifest"), "/training/files/videos/registrar-cliente.mp4", reverse("clientes")]:
            self.assertEqual(self.client.get(url).status_code, 302, url)

    def test_manifest_is_filtered_with_real_groups_and_not_cached(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("training-manifest"))
        self.assertEqual(response["Cache-Control"], "private, no-store")
        data = response.json()
        self.assertEqual([t["id"] for t in data["tutorials"]], ["registrar-cliente"])
        self.assertEqual([t["id"] for t in data["tours"]], ["registrar-cliente"])
        self.assertEqual(data["assetsBase"], "/training/files/")

        self.client.force_login(self.supervisor)
        self.assertEqual(len(self.manifest()["tutorials"]), 2)

    def test_role_restricted_files_return_404_even_with_the_exact_url(self):
        self.client.force_login(self.user)
        self.assertEqual(self.client.get("/training/files/videos/buscar-cliente.mp4").status_code, 404)
        self.assertEqual(self.client.get("/training/files/tours/buscar-cliente.json").status_code, 404)
        self.client.force_login(self.supervisor)
        self.assertEqual(self.client.get("/training/files/tours/buscar-cliente.json").status_code, 200)

    def test_unreferenced_and_traversal_paths_return_404(self):
        self.client.force_login(self.supervisor)
        for path in ["manifest.json", "../config/settings.py", "videos/../../manage.py", "videos/otro.mp4"]:
            self.assertEqual(self.client.get(f"/training/files/{path}").status_code, 404, path)

    def test_video_supports_range_requests_for_seeking(self):
        self.client.force_login(self.user)
        url = "/training/files/videos/registrar-cliente.mp4"
        full = self.client.get(url)
        size = int(full["Content-Length"])
        self.assertEqual(full["Accept-Ranges"], "bytes")
        self.assertEqual(full["Content-Type"], "video/mp4")

        part = self.client.get(url, headers={"Range": "bytes=100-199"})
        self.assertEqual(part.status_code, 206)
        self.assertEqual(part["Content-Range"], f"bytes 100-199/{size}")
        self.assertEqual(len(b"".join(part.streaming_content)), 100)

        tail = self.client.get(url, headers={"Range": "bytes=-10"})
        self.assertEqual(tail["Content-Range"], f"bytes {size - 10}-{size - 1}/{size}")
        self.assertEqual(self.client.get(url, headers={"Range": f"bytes={size}-"}).status_code, 416)

    def test_captions_are_served_as_webvtt(self):
        self.client.force_login(self.user)
        response = self.client.get("/training/files/videos/registrar-cliente.es.vtt")
        self.assertEqual(response["Content-Type"], "text/vtt")
        self.assertTrue(b"".join(response.streaming_content).startswith(b"WEBVTT"))

    def test_page_embeds_the_component_without_client_side_roles(self):
        self.client.force_login(self.user)
        html = self.client.get(reverse("clientes")).content.decode()
        self.assertIn('<seventeen-training manifest="/training/manifest.json" module="clientes" app-version="1.2.0"', html)
        self.assertIn("/static/training-kit/seventeen-training.js", html)
        self.assertNotIn("roles=", html)
