# Security

**English** · [Español](../seguridad.md)

**Core rule: the host application controls authorization. The kit only displays the
content the app hands it.**

## What the kit does

- It has no users, sessions, tokens or global identifiers. It stores no personal data
  or progress: it uses no `localStorage`, first-party cookies or analytics.
- It requests the manifest, tours and captions with `credentials: 'same-origin'`.
  It never sends credentials to other domains.
- It validates all JSON with Zod before using it, with strict objects: an unknown field is
  an error.
- It rejects `javascript:`, `data:`, `http:` and `..` paths.
- It inserts all text with `textContent`. A title containing HTML is displayed as text (there is an
  XSS test in `packages/web-component/test`).
- Tours only highlight and explain. The schema has no fields to click,
  type, submit or delete. Before running, invalid selectors are discarded, and
  missing elements are skipped (`optional`) or reported.
- The kit's events contain no user data.

## What the host app must do

1. **Protect on the server** the manifest and private content files, with its
   normal authentication (`@login_required`, middleware, guard…).
2. **Filter on the server** using the session's real roles or groups. The `roles`
   attribute and the manifest's `roles` field **are not security**: anyone can edit the
   HTML or call the URL. See `crm/training_views.py` in the Django example.
3. **Authorize every file**, not just the manifest. The Django example serves a file
   only if it is referenced by a tutorial or tour visible to the user. Guessing the URL of
   a restricted video returns 404.
4. **Do not put tokens or credentials in manifests**, tours or URLs. If signed URLs are
   needed, generate them on the server when responding, short-lived, and do not store them in the
   repository. `training validate` fails if it detects fields or values that look like credentials
   (`token`, `apiKey`, `Bearer …`, JWT, `?signature=`, `user:pass@`).
5. **Respond with `Cache-Control: private`** (or `no-store` for the manifest) for
   protected content, so shared proxies and CDNs do not store it.
6. **Do not record real data in the videos.** Generate the captures with fictitious data (the demo
   uses `.example` domains). Review every capture before publishing it: videos get distributed
   and cannot be "unpublished" from downloaded copies.

## Risks of storing private content in public directories

Anything in `public/`, `static/`, `media/` (unprotected) or a public bucket:

- **Is accessible without a session** to anyone who knows or guesses the URL. Names like
  `videos/registrar-cliente.mp4` are predictable.
- **Can remain cached** by CDNs, proxies and search engines, and stay accessible after being deleted.
- **Ignores roles.** Hiding a video in the interface does not prevent downloading it.
- **Can leak business information** (internal screens, customer names,
  processes) through the captures.

That is why the manifest has `access: "protected"`, and `training validate` warns when a
protected tutorial points to `public/`, `static/` or an https URL.

## Pre-publish review checklist

- [ ] `training validate` with no errors (in CI).
- [ ] Protected content is served from an authenticated view, outside public folders.
- [ ] The manifest is filtered on the server using the real roles.
- [ ] Captures and videos contain only fictitious data.
- [ ] The script moved from `draft` to `verified` after a person checked the procedure in the real app.
