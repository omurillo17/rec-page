# Upgrading the kit without breaking applications

**English** · [Español](../actualizacion.md)

## Versions

| Version | Changes when… | Who controls it |
|---|---|---|
| `@seventeen-training/*` packages (SemVer) | MAJOR: a public attribute, event or API changes or is removed. MINOR: new compatible features. PATCH: fixes. | Kit team |
| Content `schemaVersion` | Incompatible change to the JSON format (currently `1`). | Kit team |
| `contentVersion` | An app's content changes. | Each app |
| `ui.minVersion` / `ui.maxVersion` | The app's UI changes in a way that breaks tour selectors. | Each app |

## Rules for the kit team

1. **Do not break the public contract without a MAJOR.** Public contract: the tag name,
   attributes, events, methods, `core` exports and schemas.
2. **New schema fields are optional and have a default value.** A manifest that is
   valid today must remain valid throughout the 1.x series.
3. **If the format changes incompatibly**, bump `schemaVersion` and keep support for the
   previous version for at least one MAJOR release. Add a migration command
   to the CLI.
4. **Run `pnpm test` and both demos** before publishing. Tests cover schemas, filters,
   WebVTT, React SSR, the Web Component (including XSS) and CLI validation against the
   demo's real content.
5. **Publish release notes** with every change visible to apps.

## Rules for each application

1. **Pin the exact version** (`"@seventeen-training/web": "0.1.0"`, without `^`) or copy the
   versioned `seventeen-training.js` file (`training-kit/0.1.0/seventeen-training.js`).
   That way an upgrade is an explicit change in a PR.
2. **Validate in CI** the app's content with the CLI version it uses:

   ```bash
   npx training validate --input public/training
   ```

3. **Use `data-training` instead of CSS classes** in tours. That way a redesign does not break
   the selectors.
4. **Declare `ui.minVersion` and `ui.maxVersion`** in the manifest and pass `app-version`. If
   an app version falls outside the range, the kit hides the tours (which would fail) and
   keeps the videos.
5. **Mark as `optional`** the steps that depend on permissions or on data that may be missing.
6. **The kit fails safely.** If it does not load or the content is invalid, the button shows
   a notice and the app keeps working. Even so, check the console and listen to `training-error`
   in test environments.

## Upgrade procedure in an app

1. Read the kit's release notes.
2. Update the dependency or the copied file in a branch.
3. Run `training validate` and the app's tests.
4. Open each module with help: play a video and start its tours.
5. Publish. To roll back, just restore the previous version of the file or package:
   the kit stores no state and migrates no data.
